import styled from "styled-components";
import { GRAY_100, GRAY_200, GRAY_300, GRAY_400 } from "@/styles/color";

interface Props {
  size?: number;
  borderRadius?: number;
}

export default function GachaPlaceholder({
  size = 56,
  borderRadius = 8,
}: Props) {
  const ballSize = Math.round(size * 0.64);
  const ballRadius = ballSize / 2;
  const seamH = 2;

  return (
    <Container $size={size} $borderRadius={borderRadius}>
      <Ball $size={ballSize} $radius={ballRadius}>
        <TopHalf $height={ballRadius - seamH / 2} />
        <BottomHalf $height={ballRadius - seamH / 2} />
        <Seam $top={ballRadius - seamH / 2} $height={seamH} />
        <Shine
          $top={Math.round(ballSize * 0.18)}
          $left={Math.round(ballSize * 0.22)}
          $width={Math.round(ballSize * 0.18)}
          $height={Math.round(ballSize * 0.12)}
        />
      </Ball>
    </Container>
  );
}

const Container = styled.div<{ $size: number; $borderRadius: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $borderRadius }) => $borderRadius}px;
  background: ${GRAY_100};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

const Ball = styled.div<{ $size: number; $radius: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $radius }) => $radius}px;
  position: relative;
  overflow: hidden;
`;

const TopHalf = styled.div<{ $height: number }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: ${({ $height }) => $height}px;
  background: ${GRAY_300};
`;

const BottomHalf = styled.div<{ $height: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${({ $height }) => $height}px;
  background: ${GRAY_400};
`;

const Seam = styled.div<{ $top: number; $height: number }>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: 0;
  right: 0;
  height: ${({ $height }) => $height}px;
  background: ${GRAY_200};
`;

const Shine = styled.div<{
  $top: number;
  $left: number;
  $width: number;
  $height: number;
}>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  transform: rotate(-30deg);
`;
