import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import './index.scss';
// import Sidebar from './sidebar';
// import bubbleStyles from './sidebar/bubble/index.content.scss';
// import sidebarStyles from './sidebar/index.content.scss';

export default function Content() {
  return (
    <ErrorBoundary>
      {/* <Sidebar />
      <style type='text/css'>{sidebarStyles}</style>
      <style type='text/css'>{bubbleStyles}</style> */}
    </ErrorBoundary>
  );
}
