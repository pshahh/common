import { Metadata } from 'next';
import FriendsClient from './FriendsClient';

export const metadata: Metadata = {
  title: 'Friends | common',
  description: 'Manage your friends on common',
};

export default function FriendsPage() {
  return <FriendsClient />;
}