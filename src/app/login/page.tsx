import Link from 'next/link';

export default function LoginPage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>🔐 Login Page</h1>
      <p>This is the login page - it works!</p>
      <div style={{ marginTop: '30px' }}>
        <Link href="/" style={{ color: 'blue', marginRight: '20px' }}>Back to Home</Link>
        <Link href="/chat" style={{ color: 'blue' }}>Go to Chat</Link>
      </div>
    </div>
  );
}
