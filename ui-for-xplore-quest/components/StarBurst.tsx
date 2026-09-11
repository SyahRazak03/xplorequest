/**
 * StarBurst.tsx
 * Decorative field-journal star-burst doodle component.
 * Use only on non-functional screens: SplashScreen, RoleSelectScreen,
 * CelebrationModal, FinishLineScreen, PersonalResultsScreen.
 */

import React from 'react';
import { ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

interface StarBurstProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
  opacity?: number;
}

export const StarBurst: React.FC<StarBurstProps> = ({
  size = 48,
  color = '#F5C518',
  style,
  opacity = 1,
}) => {
  // 8-point hand-drawn style star burst
  const r1 = size / 2;       // outer radius
  const r2 = size / 4.5;     // inner radius
  const cx = size / 2;
  const cy = size / 2;
  const points = 8;

  const buildStarPath = () => {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const r = i % 2 === 0 ? r1 : r2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d + ' Z';
  };

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={style}
      opacity={opacity}
    >
      <G>
        <Path d={buildStarPath()} fill={color} />
      </G>
    </Svg>
  );
};
