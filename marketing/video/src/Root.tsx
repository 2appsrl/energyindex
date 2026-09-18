import { Composition } from "remotion";
import { EnergyIndex } from "./EnergyIndex";
import { EidxPro } from "./EidxPro";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const DUR = 60 * FPS; // 60s -> 1800 frames

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="EnergyIndex"
        component={EnergyIndex}
        durationInFrames={DUR}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="EidxPro"
        component={EidxPro}
        durationInFrames={DUR}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
}
