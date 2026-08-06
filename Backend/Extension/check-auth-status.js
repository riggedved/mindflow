// Check stored credentials
chrome.storage.local.get(['token', 'user'], (result) => {
  console.log('\n📦 Chrome Storage Contents:');
  console.log('───────────────────────────────────────────');
  
  if (result.token) {
    console.log('✅ Token exists');
    console.log('   Length:', result.token.length, 'characters');
    console.log('   Preview:', result.token.substring(0, 30) + '...');
  } else {
    console.log('❌ No token found');
  }
  
  console.log('');
  
  if (result.user) {
    console.log('✅ User info exists');
    console.log('   Name:', result.user.name);
    console.log('   Email:', result.user.email);
    console.log('   ID:', result.user.id);
  } else {
    console.log('❌ No user info found');
  }
  
  console.log('\n═══════════════════════════════════════════════');
  
  if (result.token && result.user) {
    console.log('🎉 Status: AUTHENTICATED');
    console.log('✅ Extension should work when saving content');
    console.log('\n📝 Next step: Right-click on any webpage → "Save to MindFlow"');
  } else {
    console.log('⚠️  Status: NOT AUTHENTICATED');
    console.log('❌ Extension will ask to sign in when saving');
    console.log('\n🔐 Next step: Click extension icon → Sign in with Google');
  }
  
  console.log('═══════════════════════════════════════════════\n');
});

// Test backend connectivity
console.log('\n🌐 Testing Backend Connection...');
fetch('http://localhost:8000/api/v1/extension/info')
  .then(res => res.json())
  .then(data => {
    console.log('✅ Backend is reachable');
    console.log('   Extension:', data.name);
    console.log('   Version:', data.version);
  })
  .catch(err => {
    console.log('❌ Backend connection failed');
    console.log('   Error:', err.message);
    console.log('   Make sure uvicorn is running on port 8000');
  });
