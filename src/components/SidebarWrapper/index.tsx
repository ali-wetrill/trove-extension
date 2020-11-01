import antdStyles from 'antd/dist/antd.min.css?inject';
import React from 'react';
import tabStyles from '../../styles/tabs.scss?inject';
import ErrorBoundary from '../ErrorBoundary';
import './index.scss';
import Sidebar from './Sidebar';
import sidebarStyles from './Sidebar/index.scss?inject';
import newPostStyles from './Sidebar/NewPost/index.scss?inject';
import postStyles from './Sidebar/Post/index.scss?inject';

export default function SidebarWrapper() {
  return (
    <ErrorBoundary>
      <Sidebar />
      <style type="text/css">{antdStyles}</style>
      <style type="text/css">{sidebarStyles}</style>
      <style type="text/css">{newPostStyles}</style>
      <style type="text/css">{postStyles}</style>
      <style type="text/css">{tabStyles}</style>
    </ErrorBoundary>
  );
}