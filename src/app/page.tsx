import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>✅ IT WORKS!</h1>
      <p>Simple test page - deployment is working correctly</p>
      <div style={{ marginTop: '30px' }}>
        <Link href="/login" style={{ color: 'blue', marginRight: '20px' }}>Go to Login</Link>
        <Link href="/chat" style={{ color: 'blue' }}>Go to Chat</Link>
      </div>
    </div>
  );
}
