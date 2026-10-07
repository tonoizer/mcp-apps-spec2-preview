import type { AppData } from '../utils/types.js';
interface AppListProps {
    apps: AppData[];
    displayMode: 'inline' | 'fullscreen';
}
export declare function AppList({ apps, displayMode }: AppListProps): import("react/jsx-runtime").JSX.Element | null;
export {};
