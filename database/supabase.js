import supabase from '../config/supabase.js';

const connectToDatabase = async () => {
  try {
    // Test Supabase connection by querying the auth user
    const { error } = await supabase.auth.getUser();
    
    if (error && error.status !== 400) {
      throw error;
    }
    
    console.log('Supabase connected successfully');
  } catch (error) {
    throw new Error("Supabase connection check failed.", { cause: error });
  }
};

export default connectToDatabase;
