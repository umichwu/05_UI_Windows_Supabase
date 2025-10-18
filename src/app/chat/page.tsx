export default function ChatPage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>💬 Chat Page</h1>
      <p>This is the chat page - it works!</p>
      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: 'blue', marginRight: '20px' }}>Back to Home</a>
        <a href="/login" style={{ color: 'blue' }}>Go to Login</a>
      </div>
    </div>
  );
}
