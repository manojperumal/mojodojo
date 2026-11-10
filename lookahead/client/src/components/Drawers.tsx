import { useSearchParams } from 'react-router-dom';
import { ActivityDrawer } from './ActivityDrawer';
import { ConstraintDrawer } from './ConstraintDrawer';

/** Activity (?a=) and constraint (?c=) detail drawers, addressable by URL so links from emails open them. */
export function useDrawers() {
  const [params, setParams] = useSearchParams();
  const set = (key: 'a' | 'c', id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete('a');
        n.delete('c');
        if (id) n.set(key, id);
        return n;
      },
      { replace: false },
    );
  const openActivity = (id: string) => set('a', id);
  const openConstraint = (id: string) => set('c', id);
  const element = (
    <>
      <ActivityDrawer activityId={params.get('a')} onClose={() => set('a', null)} onOpenConstraint={openConstraint} />
      <ConstraintDrawer constraintId={params.get('c')} onClose={() => set('c', null)} onOpenActivity={openActivity} />
    </>
  );
  return { openActivity, openConstraint, element };
}
