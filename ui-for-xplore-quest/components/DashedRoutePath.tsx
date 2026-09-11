/**
 * DashedRoutePath.tsx
 * Decorative field-journal dashed trail/route line SVG component.
 * Use only on non-functional screens: SplashScreen, RoleSelectScreen.
 */

import React from 'react';
import { ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface DashedRoutePathProps {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
  opacity?: number;
}

export const DashedRoutePath: React.FC<DashedRoutePathProps> = ({
  width = 200,
  height = 60,
  color = '#5B3A9E',
  style,
  opacity = 0.35,
}) => {
  // Gentle S-curve path resembling a trail route line
  const path = `M 0 ${height * 0.5} C ${width * 0.2} ${height * 0.1}, ${width * 0.5} ${height * 0.9}, ${width * 0.75} ${height * 0.3} S ${width} ${height * 0.6}, ${width} ${height * 0.5}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={style}
      opacity={opacity}
    >
      <Path
        d={path}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray="8, 6"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
};
