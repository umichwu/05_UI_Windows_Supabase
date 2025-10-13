#!/usr/bin/env python3
"""
DeepFace FastAPI Service for Face Recognition + Emotion Detection
Implements /enroll, /recognize, and /analyze endpoints using DeepFace library
"""

import os
import io
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import logging
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image
import cv2
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# DeepFace imports
from deepface import DeepFace

# Database imports
import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
MODEL_NAME = os.getenv('DEEPFACE_MODEL', 'Facenet512')  # Facenet512, VGG-Face, OpenFace, etc.
DETECTOR_BACKEND = os.getenv('DEEPFACE_DETECTOR', 'retinaface')  # opencv, retinaface, mtcnn, etc.
DISTANCE_METRIC = os.getenv('DEEPFACE_METRIC', 'cosine')  # cosine, euclidean, euclidean_l2
RECOGNITION_THRESHOLD = float(os.getenv('DEEPFACE_THRESHOLD', '0.30'))
ENABLE_ANTI_SPOOFING = os.getenv('ENABLE_ANTI_SPOOFING', 'false').lower() == 'true'

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for caching
face_db = []
db_pool = None

class FaceEmbeddingDB:
    """Simple in-memory face embedding database with PostgreSQL persistence"""

    def __init__(self):
        self.embeddings = []
        self.labels = []
        self.user_ids = []

    async def load_from_db(self):
        """Load face profiles from PostgreSQL"""
        if not db_pool:
            return

        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT user_id, label, model, embedding
                    FROM app.face_profiles
                    WHERE model = $1
                """, MODEL_NAME)

                self.embeddings = []
                self.labels = []
                self.user_ids = []

                for row in rows:
                    # Convert PostgreSQL vector to numpy array
                    embedding_str = row['embedding'].strip('[]')
                    embedding = np.array([float(x) for x in embedding_str.split(',')])

                    self.embeddings.append(embedding)
                    self.labels.append(row['label'])
                    self.user_ids.append(row['user_id'])

                logger.info(f"Loaded {len(self.embeddings)} face profiles from database")
        except Exception as e:
            logger.error(f"Failed to load face profiles: {e}")

    def add_embeddings(self, embeddings: List[np.ndarray], labels: List[str], user_ids: List[str]):
        """Add new embeddings to the database"""
        for embedding, label, user_id in zip(embeddings, labels, user_ids):
            self.embeddings.append(embedding)
            self.labels.append(label)
            self.user_ids.append(user_id)

    def find_best_match(self, query_embedding: np.ndarray) -> Tuple[str, str, float]:
        """Find best matching face using cosine similarity"""
        if len(self.embeddings) == 0:
            return None, None, float('inf')

        best_distance = float('inf')
        best_label = None
        best_user_id = None

        for i, stored_embedding in enumerate(self.embeddings):
            if DISTANCE_METRIC == 'cosine':
                distance = 1 - np.dot(query_embedding, stored_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(stored_embedding)
                )
            elif DISTANCE_METRIC == 'euclidean':
                distance = np.linalg.norm(query_embedding - stored_embedding)
            else:  # euclidean_l2
                distance = np.linalg.norm(query_embedding - stored_embedding) / np.linalg.norm(stored_embedding)

            if distance < best_distance:
                best_distance = distance
                best_label = self.labels[i]
                best_user_id = self.user_ids[i]

        return best_user_id, best_label, best_distance

# Global face database
face_db = FaceEmbeddingDB()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database connection and load face profiles"""
    global db_pool

    if DATABASE_URL:
        try:
            db_pool = await asyncpg.create_pool(DATABASE_URL)
            await face_db.load_from_db()
            logger.info("Database connection established and face profiles loaded")
        except Exception as e:
            logger.warning(f"Database connection failed: {e}")

    yield

    # Cleanup
    if db_pool:
        await db_pool.close()

# Initialize FastAPI app
app = FastAPI(
    title="DeepFace API Service",
    description="Face Recognition and Emotion Detection using DeepFace",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004", "https://vercel.app", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess uploaded image for DeepFace"""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Convert to numpy array
        img_array = np.array(image)

        # Convert RGB to BGR for OpenCV
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        return img_array
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

def detect_and_align_face(img_array: np.ndarray) -> np.ndarray:
    """Detect and align face in image"""
    try:
        # Use DeepFace's built-in detection and alignment
        detected_faces = DeepFace.extract_faces(
            img_path=img_array,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True
        )

        if len(detected_faces) == 0:
            raise ValueError("No face detected in image")

        # Return the first detected face
        face = detected_faces[0]

        # Convert back to uint8 format
        if face.max() <= 1.0:
            face = (face * 255).astype(np.uint8)

        return face
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Face detection failed: {str(e)}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "DeepFace API",
        "status": "running",
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "metric": DISTANCE_METRIC,
        "threshold": RECOGNITION_THRESHOLD,
        "profiles_loaded": len(face_db.embeddings)
    }

@app.post("/analyze")
async def analyze_emotion(image: UploadFile = File(...)):
    """Analyze emotions in uploaded image using DeepFace"""
    try:
        # Read and preprocess image
        image_bytes = await image.read()
        img_array = preprocess_image(image_bytes)

        # Analyze emotions using DeepFace
        analysis = DeepFace.analyze(
            img_path=img_array,
            actions=['emotion'],
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False
        )

        # Handle both single face and multiple faces
        if isinstance(analysis, list):
            if len(analysis) == 0:
                return JSONResponse({
                    "success": False,
                    "face_detected": False,
                    "error": "No faces detected"
                })
            analysis = analysis[0]

        # Extract emotion scores
        emotion_scores = analysis['emotion']
        dominant_emotion = analysis['dominant_emotion']
        confidence = emotion_scores[dominant_emotion] / 100.0  # Convert percentage to 0-1

        return JSONResponse({
            "success": True,
            "face_detected": True,
            "emotion_scores": {k: v/100.0 for k, v in emotion_scores.items()},
            "dominant_emotion": dominant_emotion.lower(),
            "confidence": confidence
        })

    except Exception as e:
        logger.error(f"Emotion analysis error: {e}")
        return JSONResponse({
            "success": False,
            "face_detected": False,
            "error": str(e)
        }, status_code=400)

@app.post("/enroll")
async def enroll_face(
    label: str = Form(...),
    images: List[UploadFile] = File(...)
):
    """Enroll face embeddings for a user"""
    try:
        if len(images) == 0:
            raise HTTPException(status_code=400, detail="At least one image is required")

        embeddings = []
        valid_images = 0

        for image in images:
            try:
                # Read and preprocess image
                image_bytes = await image.read()
                img_array = preprocess_image(image_bytes)

                # Detect and align face
                aligned_face = detect_and_align_face(img_array)

                # Generate embedding using DeepFace
                embedding_result = DeepFace.represent(
                    img_path=aligned_face,
                    model_name=MODEL_NAME,
                    detector_backend=DETECTOR_BACKEND,
                    enforce_detection=True
                )

                # Handle both single and multiple embeddings
                if isinstance(embedding_result, list):
                    if len(embedding_result) > 0:
                        embedding = embedding_result[0]['embedding']
                    else:
                        continue
                else:
                    embedding = embedding_result['embedding']

                embeddings.append(np.array(embedding))
                valid_images += 1

            except Exception as e:
                logger.warning(f"Failed to process image {image.filename}: {e}")
                continue

        if valid_images == 0:
            raise HTTPException(status_code=400, detail="No valid faces found in uploaded images")

        # Return enrollment results (without storing to DB here - that's handled by the Next.js API)
        return JSONResponse({
            "success": True,
            "profiles_created": valid_images,
            "embeddings": [
                {
                    "label": label,
                    "model": MODEL_NAME,
                    "embedding": embedding.tolist()
                }
                for embedding in embeddings
            ]
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face enrollment error: {e}")
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")

@app.post("/recognize")
async def recognize_face(
    image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Recognize face and analyze emotions"""
    try:
        # Read and preprocess image
        image_bytes = await image.read()
        img_array = preprocess_image(image_bytes)

        # Analyze emotions first
        emotion_result = None
        try:
            analysis = DeepFace.analyze(
                img_path=img_array,
                actions=['emotion'],
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False
            )

            if isinstance(analysis, list) and len(analysis) > 0:
                analysis = analysis[0]

            if analysis and 'emotion' in analysis:
                emotion_scores = analysis['emotion']
                dominant_emotion = analysis['dominant_emotion']
                emotion_confidence = emotion_scores[dominant_emotion] / 100.0

                emotion_result = {
                    "emotion_scores": {k: v/100.0 for k, v in emotion_scores.items()},
                    "dominant_emotion": dominant_emotion.lower(),
                    "confidence": emotion_confidence
                }
        except Exception as e:
            logger.warning(f"Emotion analysis failed during recognition: {e}")
            emotion_result = {
                "emotion_scores": {"neutral": 1.0},
                "dominant_emotion": "neutral",
                "confidence": 0.5
            }

        # Face recognition
        recognized_user = None
        distance = None

        try:
            # Detect and align face
            aligned_face = detect_and_align_face(img_array)

            # Generate embedding
            embedding_result = DeepFace.represent(
                img_path=aligned_face,
                model_name=MODEL_NAME,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=True
            )

            if isinstance(embedding_result, list):
                if len(embedding_result) > 0:
                    query_embedding = np.array(embedding_result[0]['embedding'])
                else:
                    raise ValueError("No embedding generated")
            else:
                query_embedding = np.array(embedding_result['embedding'])

            # Find best match in database
            best_user_id, best_label, best_distance = face_db.find_best_match(query_embedding)

            if best_distance <= RECOGNITION_THRESHOLD:
                recognized_user = best_user_id
                distance = best_distance

        except Exception as e:
            logger.warning(f"Face recognition failed: {e}")

        # Check for spoofing (simplified - you can enhance this with specialized models)
        is_spoof = False
        if ENABLE_ANTI_SPOOFING:
            try:
                # Basic liveness check - detect if image has realistic face properties
                # This is a simplified implementation
                gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
                laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                is_spoof = laplacian_var < 100  # Threshold for blur detection
            except:
                is_spoof = False

        return JSONResponse({
            "success": True,
            "recognized_user": recognized_user,
            "distance": distance,
            "is_spoof": is_spoof,
            **emotion_result
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face recognition error: {e}")
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

@app.post("/reload_profiles")
async def reload_profiles():
    """Reload face profiles from database"""
    try:
        await face_db.load_from_db()
        return JSONResponse({
            "success": True,
            "profiles_loaded": len(face_db.embeddings),
            "message": "Face profiles reloaded successfully"
        })
    except Exception as e:
        logger.error(f"Failed to reload profiles: {e}")
        raise HTTPException(status_code=500, detail=f"Profile reload failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting DeepFace API service on {host}:{port}")
    logger.info(f"Model: {MODEL_NAME}, Detector: {DETECTOR_BACKEND}, Metric: {DISTANCE_METRIC}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )