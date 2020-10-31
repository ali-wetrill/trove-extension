import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Edge from '../../SidebarWrapper/helpers/Edge';
import Point from '../../SidebarWrapper/helpers/Point';

const TOOLTIP_MARGIN = 10;
const TOOLTIP_HEIGHT = 150;

export default function Tooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState(new Point(0, 0));
  const [positionEdge, setPositionEdge] = useState(Edge.Bottom);

  const onSelectionChange = useCallback(() => {
    const selection = getSelection();
    if (selection && selection.rangeCount && selection.toString()) {
      const selPos = selection.getRangeAt(0).getBoundingClientRect();
      if (selPos.bottom + TOOLTIP_HEIGHT > document.documentElement.clientHeight) {
        setPositionEdge(Edge.Top);
        setPosition(new Point(selPos.left, selPos.top - TOOLTIP_HEIGHT - TOOLTIP_MARGIN));
      } else {
        setPositionEdge(Edge.Bottom);
        setPosition(new Point(selPos.left, selPos.bottom));
      }
      
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [onSelectionChange]);

  return (
    <>
      {isVisible && (
        <div 
          className={classNames('TbdTooltip', {
            'TbdTooltip--position-above': positionEdge === Edge.Top,
            'TbdTooltip--position-below': positionEdge === Edge.Bottom
          })}
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0px)` }}
        >
        </div>
      )}
    </>
  );
}
