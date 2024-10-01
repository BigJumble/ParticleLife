import { Actions, PlayerAction } from "./actions.js";
import { Animator } from "./animator.js";
// import { Renderer } from "./renderer.js";

export class Controller {

    static update(deltaTime: number) {


        if (Actions.isClicked(PlayerAction.Jump)) {
            console.log("Jump");
            Animator.isUpdating = !Animator.isUpdating;
            return;
        }
        // if (Actions.isClicked(PlayerAction.Primary))
        //     Renderer.isDrawing = true;

        // if (Actions.isHeld(PlayerAction.Primary))
        // {
        //     Renderer.setPaintPos(Actions.screenMouseX,Actions.screenMouseY);
        // }


        // if (Actions.isReleased(PlayerAction.Primary))
        //     Renderer.isDrawing = false;

    }

}