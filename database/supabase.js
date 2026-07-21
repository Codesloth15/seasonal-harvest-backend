import supabase from '../config/supabase.js';

const connectToDatabase = async () => {
  try {
    // Test Supabase connection by querying the auth user
    const { data, error } = await supabase.auth.getUser();
    
    if (error && error.status !== 400) {
      throw error;
    }
    
    console.log('Supabase connected successfully');
  } catch (error) {
    console.log(`Something went wrong: ${error.message}`);
    process.exit(1);
  }
};

export default connectToDatabase;
