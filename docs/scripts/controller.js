import { Actions, PlayerAction } from "./actions.js";
import { Animator } from "./animator.js";
export class Controller {
    static update(deltaTime) {
        if (Actions.isClicked(PlayerAction.Jump)) {
            console.log("Jump");
            Animator.isUpdating = !Animator.isUpdating;
            return;
        }
    }
}
