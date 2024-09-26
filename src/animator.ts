import { Controller } from "./controller.js";
import { Renderer } from "./renderer.js";


export class Animator {

    static isUpdating = false;
    static lastTimestamp = 0;
    static deltaTime = 0;
    static moveSpeed = 20;
    static FPSCounter = 0;
    static FPSLimit: number = 0; // 0 to disable

    static logFPS() {
        setInterval(() => {
            console.log("FPS:", this.FPSCounter);
            this.FPSCounter = 0;
        }, 1000);
    }

    static startUpdate() {
        if (this.isUpdating) return;

        this.isUpdating = true;
        this.lastTimestamp = performance.now();
        if (Animator.FPSLimit !== 0) {
            setInterval(() => {
                if (Animator.FPSLimit !== 0) {
                    requestAnimationFrame(Animator.#smoothUpdate);
                }
            }, 1000 / Animator.FPSLimit);
        }
        else
        {
            requestAnimationFrame(Animator.#smoothUpdate);
        }
    }

    static #smoothUpdate(timestamp: number) {
        Animator.deltaTime = (timestamp - Animator.lastTimestamp) / 1000;
        Animator.lastTimestamp = timestamp;
        Animator.FPSCounter++;


        Controller.update(Animator.deltaTime);
        Renderer.update(Animator.deltaTime);
        if (Animator.FPSLimit === 0)
            requestAnimationFrame(Animator.#smoothUpdate);
    }
}