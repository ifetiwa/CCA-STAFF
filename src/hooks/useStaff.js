import { useEffect, useState } from 'react';
import { getAllStaff, subscribeStaff } from '../data/staff';

// Subscribe a component to the live staff store. Re-renders on every mutation
// (add / update / remove) so Dashboard, StaffList and StaffDetail stay in sync.
export const useStaff = () => {
  const [list, setList] = useState(getAllStaff());
  useEffect(() => subscribeStaff(setList), []);
  return list;
};
