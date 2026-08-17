export type AuthProfile = {
    id: string;
    name: string;
    email: string;
    image: string | null;
};

export type AuthState =
    | { status: 'signedOut' }
    | { status: 'pending'; userCode: string; verificationUri: string }
    | { status: 'signedIn'; profile: AuthProfile };
