import { Actions } from "./actions.js";
import { Animator } from "./animator.js";
import { Renderer } from "./renderer.js";
async function main() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }
    await Renderer.init();
    Actions.init();
    Animator.startUpdate();
}
main();
