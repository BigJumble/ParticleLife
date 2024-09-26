import { Renderer } from "./renderer.js";

export enum PlayerAction {
    Up = "KeyW",
    Down = "KeyS",
    Left = "KeyA",
    Right = "KeyD",
    CamUp = "ArrowUp",
    CamDown = "ArrowDown",
    CamLeft = "ArrowLeft",
    CamRight = "ArrowRight",
    Jump = "Space",
    Run = "ShiftLeft",
    Primary = "Mouse0",
    Secondary = "Mouse2",
    Interact = "KeyE",
    OpenMenu = "KeyQ",
    D1 = "Digit1",
    D2 = "Digit2",
    D3 = "Digit3",
    D4 = "Digit4",
}

export enum GameState {
    MenuOpen,
}

export class Actions {
    static #buttonsReleased = new Set<PlayerAction>();
    static #buttonsPressedSingle = new Set<PlayerAction>();
    static #buttonsPressed = new Set<PlayerAction>();
    static gameState = new Set<GameState>();
    static #invertedGA: Record<string, keyof typeof PlayerAction>;

    static screenMouseX = 0;
    static screenMouseY = 0;

    static init() {
        document.onkeydown = (e) => this.#keyDown(e);
        document.onkeyup = (e) => this.#keyUp(e);
        document.onmousedown = (e) => this.#mouseDown(e);
        document.onmouseup = (e) => this.#mouseUp(e);

        window.onmousemove = (e) => this.#mouseMove(e);
        window.onresize = () => this.resize();
        window.oncontextmenu = (e) => {e.preventDefault();};

        this.#invertGA();
    }

    static resize()
    {
        Renderer.resize();
    }

    static #invertGA() {
        var ret: Record<string, keyof typeof PlayerAction> = {};
        for (const key in PlayerAction) {
            ret[PlayerAction[key as keyof typeof PlayerAction]] = key as keyof typeof PlayerAction; // kinssl - keep it not simple silly lol
        }
        this.#invertedGA = ret;
    }

    /** Returns true every frame if button is pressed */
    static isHeld(PA: PlayerAction)
    {
        return this.#buttonsPressed.has(PA);
    }

    /** Returns true once, every other call returns false until button is released*/
    static isClicked(PA: PlayerAction)
    {
        const res = this.#buttonsPressed.has(PA) && (!this.#buttonsPressedSingle.has(PA));
        if(res) this.#buttonsPressedSingle.add(PA);
        return res;
    }

    /** Returns true once and only the next frame after isHeld stops*/
    static isReleased(PA:PlayerAction)
    {
        return this.#buttonsReleased.delete(PA);
    }

    static releasedUpdate()
    {
        this.#buttonsReleased.clear();
    }

    /** GameState shows what is going on in the scene, i.e. menu is open or player is in the water, etc. */
    static addState(state: GameState)
    {
        this.gameState.add(state);
    }
    /** GameState shows what is going on in the scene, i.e. menu is open or player is in the water, etc. */
    static hasState(state: GameState)
    {
        return this.gameState.has(state);
    }
    /** GameState shows what is going on in the scene, i.e. menu is open or player is in the water, etc. Returns true if state existed */
    static deleteState(state: GameState)
    {
        return this.gameState.delete(state);
    }



    static #keyDown(e: KeyboardEvent) {
        // e.preventDefault();
        const action = this.#getActionFromKeyCode(e.code);
        if (action) {
            this.#buttonsPressed.add(PlayerAction[action]);
        }
    }
    static #keyUp(e: KeyboardEvent) {
        const action = this.#getActionFromKeyCode(e.code);
        if (action) {
            this.#buttonsPressed.delete(PlayerAction[action]);
            this.#buttonsPressedSingle.delete(PlayerAction[action]);
            this.#buttonsReleased.add(PlayerAction[action]);
        }
    }

    static #mouseMove(e: MouseEvent) {
        this.screenMouseX = e.clientX;
        this.screenMouseY = e.clientY;
    }

    static #mouseDown(e: MouseEvent) {
        e.preventDefault();
        const action = this.#getActionFromKeyCode("Mouse" + e.button);
        if (action) {
            this.#buttonsPressed.add(PlayerAction[action]);
        }
    }

    static #mouseUp(e: MouseEvent) {
        const action = this.#getActionFromKeyCode("Mouse" + e.button);
        if (action) {
            this.#buttonsPressed.delete(PlayerAction[action]);
            this.#buttonsPressedSingle.delete(PlayerAction[action]);
            this.#buttonsReleased.add(PlayerAction[action]);
        }
    }



    static #getActionFromKeyCode(code: string): keyof typeof PlayerAction {
        return this.#invertedGA[code];
    }

    static changeKeyBinding(gs: PlayerAction, newKey: string) {
        (PlayerAction as any)[gs] = newKey;
        this.#invertGA();
    }

}
