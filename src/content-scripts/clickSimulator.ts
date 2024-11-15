export class ClickIndicator {
    private element: HTMLDivElement | null = null;
    private initialized: boolean = false;

    constructor() {
        this.waitForDOM();
    }

    private waitForDOM() {
        if (document.body) {
            this.init();
        } else {
            // Wait for DOM to be ready
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
    }

    private init() {
        if (this.initialized) return;

        this.element = document.createElement('div');
        this.element.id = 'web-copilot-click-indicator';
        this.element.style.cssText = `
            position: fixed;
            pointer-events: none;
            width: 40px;
            height: 40px;
            border: 2px solid #22c55e;
            background-color: rgba(34, 197, 94, 0.2);
            border-radius: 50%;
            z-index: 2147483647;
            transform: translate(-50%, -50%);
            transition: all 0.4s ease-out;
            opacity: 0;
        `;
        document.body.appendChild(this.element);
        this.initialized = true;
    }

    show(x: number, y: number) {
        if (!this.initialized) {
            this.init();
        }
        if (!this.element) return;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.opacity = '1';
        this.element.animate([
            { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
        ], {
            duration: 300,
            iterations: 1
        });
    }

    hide() {
        if (!this.element) return;
        this.element.style.opacity = '0';
    }

    cleanup() {
        if (this.element?.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.initialized = false;
    }

    public async handleClick(payload: any, sendResponse: (response: any) => void) {
        if (!payload.coordinates) {
            sendResponse({
                success: false,
                error: 'Missing required click coordinates'
            });
            return true;
        }
        
        const [x, y] = payload.coordinates.split(':').map(Number);
        if (isNaN(x) || isNaN(y)) {
            sendResponse({
                success: false,
                error: 'Invalid coordinate format. Expected "x:y" where x and y are numbers'
            });
            return true;
        }

        try {
            const result = await this.simulateClick(x, y, payload.clickType);
            sendResponse({ success: true, result });
        } catch (error) {
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return true;
    }

    public async simulateClick(
        x: number, 
        y: number, 
        clickType: 'single' | 'double' | 'triple' = 'single'
    ): Promise<string> {
        try {
            this.show(x, y);
            // Wait for both the initial delay and animation to complete
            await new Promise(resolve => setTimeout(resolve, 400));

            const element = document.elementFromPoint(x, y);
            if (!element) {
                throw new Error(`No clickable element found at (${x}, ${y})`);
            }

            // Define the base sequence of pointer events for a single click
            const singleClickSequence: Array<[string, PointerEventInit]> = [
                ['pointerover', { isPrimary: true, pressure: 0, pointerId: 1 }],
                ['pointerenter', { isPrimary: true, pressure: 0, pointerId: 1 }],
                ['pointermove', { isPrimary: true, pressure: 0, pointerId: 1 }],
                ['pointerdown', { isPrimary: true, pressure: 0.5, pointerId: 1 }],
                ['pointerup', { isPrimary: true, pressure: 0, pointerId: 1 }],
                ['mousedown', { buttons: 1 }],
                ['focus', { bubbles: true }],
                ['mouseup', { buttons: 0 }],
                ['click', { buttons: 0 }],
                ['focus', { bubbles: true }]
            ];

            // Function to dispatch a sequence of events
            const dispatchSequence = async (sequence: Array<[string, PointerEventInit]>) => {
                for (const [type, options] of sequence) {
                    const eventInit = {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        screenX: x,
                        screenY: y,
                        ...options
                    };

                    let event;
                    if (type.startsWith('pointer')) {
                        event = new PointerEvent(type, {
                            pointerType: 'mouse',
                            width: 1,
                            height: 1,
                            ...eventInit
                        });
                    } else {
                        event = new MouseEvent(type, eventInit);
                    }

                    element.dispatchEvent(event);
                    // console.log(`Dispatched ${type} at (${x}, ${y}) on`, element);
                }
            };

            // Handle different click types
            switch (clickType) {
                case 'double':
                    await dispatchSequence(singleClickSequence);
                    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay between clicks
                    await dispatchSequence(singleClickSequence);
                    // Dispatch dblclick event
                    element.dispatchEvent(new MouseEvent('dblclick', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        screenX: x,
                        screenY: y
                    }));
                    break;

                case 'triple':
                    await dispatchSequence(singleClickSequence);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await dispatchSequence(singleClickSequence);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await dispatchSequence(singleClickSequence);
                    // Select all text if it's an input element
                    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                        element.select();
                    }
                    break;

                default: // single click
                    await dispatchSequence(singleClickSequence);
            }

            // Attempt to focus on the element after events
            if (element instanceof HTMLElement) {
                element.focus();
                // console.log(`Focused on element at (${x}, ${y})`);
            }

            this.hide();
            const clickTypeStr = clickType === 'single' ? '' : ` (${clickType} click)`;
            return `Successfully clicked ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} at (${x}, ${y})${clickTypeStr}`;
        } catch (error) {
            this.hide();
            return `Error during ${clickType} click simulation: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
