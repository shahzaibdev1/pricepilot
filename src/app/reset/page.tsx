import AuthForm from '@/components/auth-form';
export default function Reset() {
  return (
    <AuthForm
      reset
      configured={Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      )}
    />
  );
}
