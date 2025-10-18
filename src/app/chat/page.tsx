import Link from 'next/link';

export default function ChatPage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>💬 Chat Page</h1>
      <p>This is the chat page - it works!</p>
      <div style={{ marginTop: '30px' }}>
        <Link href="/" style={{ color: 'blue', marginRight: '20px' }}>Back to Home</Link>
        <Link href="/login" style={{ color: 'blue' }}>Go to Login</Link>
      </div>
    </div>
  );
}
