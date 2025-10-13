// Test script to verify delete message functionality
console.log('Testing delete message function...');

// This will help us see if there's a caching issue
const testDeleteMessage = () => {
  console.log('Delete message function:');
  console.log(`
    const { error } = await supabase
      .schema('app')           // ✅ Schema is specified
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
  `);
};

testDeleteMessage();