import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import WorldDrawer from './WorldDrawer.jsx';
import FriendDialog from './FriendDialog.jsx';

const DrawerCtx = createContext(null);

/** openWorld(id) / openFriend(id)：任意页面点名字就能开右侧抽屉 */
export function useDrawer() {
  return useContext(DrawerCtx) ?? { openWorld: () => {}, openFriend: () => {}, close: () => {} };
}

export function DrawerProvider({ children }) {
  const [world, setWorld] = useState(null);
  const [friend, setFriend] = useState(null);
  const openWorld = useCallback((id) => { if (id) { setFriend(null); setWorld(id); } }, []);
  const openFriend = useCallback((id) => { if (id) { setWorld(null); setFriend(id); } }, []);
  const close = useCallback(() => { setWorld(null); setFriend(null); }, []);
  const value = useMemo(() => ({ openWorld, openFriend, close }), [openWorld, openFriend, close]);

  return (
    <DrawerCtx.Provider value={value}>
      {children}
      {world ? <WorldDrawer id={world} onClose={close} /> : null}
      {friend ? <FriendDialog id={friend} onClose={close} /> : null}
    </DrawerCtx.Provider>
  );
}
