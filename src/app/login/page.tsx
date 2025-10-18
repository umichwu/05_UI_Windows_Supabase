export default function LoginPage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>🔐 Login Page</h1>
      <p>This is the login page - it works!</p>
      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: 'blue', marginRight: '20px' }}>Back to Home</a>
        <a href="/chat" style={{ color: 'blue' }}>Go to Chat</a>
      </div>
    </div>
  );
}
