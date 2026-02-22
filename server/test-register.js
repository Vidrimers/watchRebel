import fetch from 'node-fetch';

async function testRegister() {
  try {
    const response = await fetch('http://localhost:1313/api/auth/register-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test1234',
        displayName: 'Test User'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRegister();
