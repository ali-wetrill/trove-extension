// import seedrandom from 'alea';
// import React from 'react';
// import {User} from '../../../../models';

// export default function Comment() {
//   const bgColor = getPastelColor(props.user.name);

//   const name = () => {
//     if (!props.user.name || props.user.name === '') return '';
//     return props.user.name.charAt(0);
//   }

//   const handleClick = (e) => {
//     console.log("HELP")
//   }

//   return (
//     <div 
//       className={`TbdSidebar__Handle TbdSidebar__Bubble ${props.visible ? '' : 'hidden'}`}
//       onClick={handleClick} 
//       style={{ 
//         backgroundColor: bgColor, 
//         // marginTop: props.visible ? '0' : `-${BUBBLE_HEIGHT}px`,
//         // marginBottom: props.visible ? `${BUBBLE_MARGIN}px` : '0'
//       }}
//     >
//       <p className="TbdSidebar__Bubble__DisplayChar">{name()}</p>
//     </div>
//   );
// }

// function getPastelColor(seed: string): string {
//   const rand = seedrandom(seed)();
//   return `hsl(${360 * rand}, ${25 + 70 * rand}%, ${85 + 10 * rand}%)`;
// }
