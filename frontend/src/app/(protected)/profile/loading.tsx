import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton';

/**
 * Instant route-level skeleton while the client profile page hydrates and fetches.
 * Avoids a blank flash during navigation to /profile.
 */
export default function ProfileLoading() {
    return <ProfileSkeleton />;
}
