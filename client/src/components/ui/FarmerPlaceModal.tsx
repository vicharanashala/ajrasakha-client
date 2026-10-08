import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';
import LocationEditor from '../Chat/LocationEditor';

export default function FarmerPlaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthContext();
  const profile = user?.farmerProfile as any;
  if (!profile) return null;

  return (
    <OGDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <OGDialogContent className="w-11/12 max-w-md p-4 sm:p-6">
        <OGDialogHeader>
          <OGDialogTitle>Update your location</OGDialogTitle>
          <p className="text-sm text-text-secondary">
            Your location details are incomplete. Please fill in the remaining fields so we can
            accurate local advice.
          </p>
        </OGDialogHeader>
        <LocationEditor
          profile={profile}
          requireAll
          onSaved={onClose}
          onCancel={onClose}
          cancelLabel="Later"
        />
      </OGDialogContent>
    </OGDialog>
  );
}
