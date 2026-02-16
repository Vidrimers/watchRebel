import { useSelector } from 'react-redux';

// Custom hook для типизированного selector
export const useAppSelector = (selector) => useSelector(selector);
