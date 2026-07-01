import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

type Props = {
  onSuccess: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
};

export default function GoogleSignInButton({ onSuccess, onError, disabled }: Props) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  if (!clientId) {
    return (
      <p className="rental-auth-hint">
        Google Sign-In is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your
        environment.
      </p>
    );
  }

  return (
    <div className={`google-signin-wrap${disabled ? " google-signin-wrap--disabled" : ""}`}>
      <GoogleLogin
        onSuccess={(res: CredentialResponse) => {
          if (res.credential) void onSuccess(res.credential);
          else onError?.("Google sign-in did not return a credential");
        }}
        onError={() => onError?.("Google sign-in was cancelled or failed")}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        width="320"
      />
    </div>
  );
}
