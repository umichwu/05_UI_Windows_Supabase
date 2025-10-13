#!/usr/bin/env python3
"""
Simple face detection script that can be called from the web API
Uses DeepFace for actual face detection
"""
import sys
import json
import base64
import cv2
import numpy as np
from PIL import Image
import io

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False

def detect_faces(image_base64):
    """Detect faces in base64 encoded image using proper DeepFace API"""
    if not DEEPFACE_AVAILABLE:
        return {"success": False, "error": "DeepFace not available"}

    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        image = Image.open(io.BytesIO(image_data))

        # Convert to numpy array
        img_array = np.array(image)

        print(f"Original image shape: {img_array.shape}", file=sys.stderr)

        # Handle RGBA images (4 channels) - convert to RGB first
        if len(img_array.shape) == 3 and img_array.shape[2] == 4:
            print("Converting RGBA to RGB", file=sys.stderr)
            # Remove alpha channel
            img_array = img_array[:, :, :3]

        # Convert RGB to BGR for OpenCV
        if len(img_array.shape) == 3 and img_array.shape[2] == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        print(f"Image shape: {img_array.shape}", file=sys.stderr)

        # Use DeepFace extract_faces to get proper bounding boxes
        try:
            # First extract faces to get accurate bounding boxes
            face_objs = DeepFace.extract_faces(
                img_path=img_array,
                detector_backend='mtcnn',
                enforce_detection=False,
                align=True
            )

            print(f"DeepFace extract_faces found: {len(face_objs)} faces", file=sys.stderr)

            if not face_objs:
                print("No faces extracted", file=sys.stderr)
                return {"success": True, "faces": []}

            faces = []
            for i, face_obj in enumerate(face_objs):
                print(f"Processing face {i + 1}: {face_obj.keys()}", file=sys.stderr)

                if 'facial_area' in face_obj:
                    facial_area = face_obj['facial_area']
                    x, y, w, h = facial_area['x'], facial_area['y'], facial_area['w'], facial_area['h']
                    print(f"Face {i + 1} facial_area: x={x}, y={y}, w={w}, h={h}", file=sys.stderr)

                    # Skip faces with invalid bounding boxes
                    if w <= 0 or h <= 0 or x < 0 or y < 0:
                        print(f"Skipping face {i + 1} with invalid bounding box", file=sys.stderr)
                        continue

                    # Now analyze emotion for this specific face
                    try:
                        # Extract the face region for emotion analysis
                        face_region = img_array[y:y+h, x:x+w]
                        if face_region.size == 0:
                            print(f"Empty face region for face {i + 1}", file=sys.stderr)
                            continue

                        emotion_results = DeepFace.analyze(
                            img_path=face_region,
                            actions=['emotion'],
                            detector_backend='opencv',  # Use opencv for emotion analysis on cropped face
                            enforce_detection=False
                        )

                        if isinstance(emotion_results, list) and len(emotion_results) > 0:
                            emotion_data = emotion_results[0]
                        else:
                            emotion_data = emotion_results

                        emotion_scores = emotion_data.get('emotion', {})
                        dominant_emotion = emotion_data.get('dominant_emotion', 'neutral')

                        # Convert emotion percentages to 0-1 scale
                        emotion_scores_normalized = {}
                        for emotion, score in emotion_scores.items():
                            emotion_scores_normalized[emotion] = float(score / 100.0)

                        face_data = {
                            'bbox': [int(x), int(y), int(w), int(h)],
                            'emotion': {
                                'dominant': dominant_emotion.lower(),
                                'scores': emotion_scores_normalized,
                                'confidence': float(emotion_scores.get(dominant_emotion, 50) / 100.0)
                            },
                            'identity': None,
                            'spoof': False
                        }
                        faces.append(face_data)
                        print(f"Added face data: {face_data}", file=sys.stderr)

                    except Exception as e:
                        print(f"Emotion analysis failed for face {i + 1}: {e}", file=sys.stderr)
                        # Still add the face with basic data
                        face_data = {
                            'bbox': [int(x), int(y), int(w), int(h)],
                            'emotion': {
                                'dominant': 'neutral',
                                'scores': {'neutral': 1.0},
                                'confidence': 0.5
                            },
                            'identity': None,
                            'spoof': False
                        }
                        faces.append(face_data)

            print(f"Total faces processed: {len(faces)}", file=sys.stderr)
            return {
                "success": True,
                "faces": faces
            }

        except Exception as e:
            print(f"DeepFace analysis failed: {e}", file=sys.stderr)
            # Return empty faces instead of error
            return {
                "success": True,
                "faces": []
            }

    except Exception as e:
        print(f"Image processing failed: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("Python face detection script started", file=sys.stderr)

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image data provided"}))
        sys.exit(1)

    image_base64 = sys.argv[1]
    print(f"Processing image data of length: {len(image_base64)}", file=sys.stderr)

    result = detect_faces(image_base64)
    print(f"Detection result: {result}", file=sys.stderr)
    print(json.dumps(result))