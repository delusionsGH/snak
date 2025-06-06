Deno.serve({
    port: 8080,
}, async (req) => {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") {
        return new Response(handlers.info(), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (req.method === "POST" && url.pathname === "/start") {
        const body = await req.json();
        handlers.start(body);
        return new Response("ok", { status: 200 });
    }
    if (req.method === "POST" && url.pathname === "/move") {
        const body = await req.json();
        return new Response(handlers.move(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (req.method === "POST" && url.pathname === "/end") {
        const body = await req.json();
        handlers.end(body);
        return new Response("ok", { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
});

const handlers = {
    info() {
        const colors = [
            "#888888",
            "#FF5733",
            "#33FF57",
            "#3357FF",
            "#FFD700",
            "#00CED1",
        ];
        const heads = [
            "default",
            "beluga",
            "evil",
            "sand-worm",
            "smile",
            "tiger",
        ];
        const tails = ["default", "bolt", "coffee", "pixel", "sharp", "skinny"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const head = heads[Math.floor(Math.random() * heads.length)];
        const tail = tails[Math.floor(Math.random() * tails.length)];
        return JSON.stringify({
            apiversion: "1",
            author: "delusionss5",
            color,
            head,
            tail,
        });
    },
    start(_body) {
        return "ok";
    },
    move(body) {
        const { board, you } = body;
        const move = calculateMove(board, you);
        return JSON.stringify({ move });
    },
    end(_body) {
        return "ok";
    },
};

function evaluateSnakeTargets(board, you) {
    const targets = [];
    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;

        const headDistance = Math.abs(you.head.x - snake.head.x) +
            Math.abs(you.head.y - snake.head.y);
        if (headDistance > 8) continue;

        targets.push({
            snake,
            headDist: headDistance,
            isSmallerSnake: snake.length < you.length,
            isEqualSize: snake.length === you.length,
            head: snake.head,
            possibleMoves: ["up", "down", "left", "right"].map((move) => ({
                x: snake.head.x +
                    (move === "left" ? -1 : move === "right" ? 1 : 0),
                y: snake.head.y +
                    (move === "up" ? 1 : move === "down" ? -1 : 0),
            })).filter((pos) =>
                pos.x >= 0 && pos.x < board.width &&
                pos.y >= 0 && pos.y < board.height
            ),
        });
    }
    return targets.sort((a, b) => a.headDist - b.headDist);
}

function calculateInterceptionMove(myHead, targetHead, board, you) {
    const possibleMoves = ["up", "down", "left", "right"];
    const possibleHeadMoves = [];

    for (const move of possibleMoves) {
        const pos = {
            x: targetHead.x + (move === "left" ? -1 : move === "right" ? 1 : 0),
            y: targetHead.y + (move === "up" ? 1 : move === "down" ? -1 : 0),
        };
        if (
            pos.x >= 0 && pos.x < board.width && pos.y >= 0 &&
            pos.y < board.height
        ) {
            possibleHeadMoves.push(pos);
        }
    }

    const interceptMoves = possibleMoves.map((move) => {
        const nextHead = {
            x: myHead.x + (move === "left" ? -1 : move === "right" ? 1 : 0),
            y: myHead.y + (move === "up" ? 1 : move === "down" ? -1 : 0),
        };

        const interceptCount = possibleHeadMoves.filter((targetPos) =>
            Math.abs(nextHead.x - targetPos.x) +
                    Math.abs(nextHead.y - targetPos.y) <= 1
        ).length;

        return { move, nextHead, interceptCount };
    }).filter((m) => m.interceptCount > 0);

    return interceptMoves.sort((a, b) =>
        b.interceptCount - a.interceptCount
    )[0];
}

function calculateMove(board, you) {
    const myHead = you.head;
    const myBody = you.body;
    const food = board.food || [];
    const width = board.width;
    const height = board.height;

    const targets = evaluateSnakeTargets(board, you);

    function getNextHead(move) {
        const nextHead = { ...myHead };
        switch (move) {
            case "up":
                nextHead.y++;
                break;
            case "down":
                nextHead.y--;
                break;
            case "left":
                nextHead.x--;
                break;
            case "right":
                nextHead.x++;
                break;
        }
        return nextHead;
    }
    function isSafe(move, nextHead) {
        if (
            nextHead.x < 0 || nextHead.x >= width || nextHead.y < 0 ||
            nextHead.y >= height
        ) {
            return false;
        }

        if (
            board.hazards &&
            board.hazards.some((h) => h.x === nextHead.x && h.y === nextHead.y)
        ) {
            if (you.health <= 15) {
                return false;
            }
        }

        const willEatFood = food.some((f) =>
            f.x === nextHead.x && f.y === nextHead.y
        );
        const simulatedBody = willEatFood ? myBody : myBody.slice(0, -1);

        if (
            simulatedBody.some((segment) =>
                nextHead.x === segment.x && nextHead.y === segment.y
            )
        ) {
            return false;
        }

        for (const snake of board.snakes) {
            if (snake.id === you.id) continue;

            if (
                snake.body.some((segment) =>
                    nextHead.x === segment.x && nextHead.y === segment.y
                )
            ) {
                return false;
            }

            const headMoves = [
                { x: snake.head.x + 1, y: snake.head.y },
                { x: snake.head.x - 1, y: snake.head.y },
                { x: snake.head.x, y: snake.head.y + 1 },
                { x: snake.head.x, y: snake.head.y - 1 },
            ];
            for (const move of headMoves) {
                if (
                    move.x === nextHead.x && move.y === nextHead.y &&
                    snake.length >= you.length
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    function isImmediateSelfCollision(move) {
        const nextHead = getNextHead(move);
        const willGrow = food.some((f) =>
            f.x === nextHead.x && f.y === nextHead.y
        );
        if (myBody.length <= 1) return false;
        const simulatedBody = willGrow
            ? [nextHead, ...myBody]
            : [nextHead, ...myBody.slice(0, -1)];
        return simulatedBody.slice(1).some((segment) =>
            segment.x === nextHead.x && segment.y === nextHead.y
        );
    }

    function isNextTurnSelfCollision(move) {
        const nextHead = getNextHead(move);
        const willGrow = food.some((f) =>
            f.x === nextHead.x && f.y === nextHead.y
        );
        if (myBody.length <= 1) return false;
        const simulatedBody = willGrow
            ? [nextHead, ...myBody]
            : [nextHead, ...myBody.slice(0, -1)];

        for (const nextMove of ["up", "down", "left", "right"]) {
            const futureHead = {
                x: nextHead.x +
                    (nextMove === "left" ? -1 : nextMove === "right" ? 1 : 0),
                y: nextHead.y +
                    (nextMove === "up" ? 1 : nextMove === "down" ? -1 : 0),
            };
            const willGrowNext = food.some((f) =>
                f.x === futureHead.x && f.y === futureHead.y
            );
            const futureBody = willGrowNext
                ? [futureHead, ...simulatedBody]
                : [futureHead, ...simulatedBody.slice(0, -1)];

            if (
                futureBody.slice(1).some((segment) =>
                    segment.x === futureHead.x && segment.y === futureHead.y
                )
            ) {
                return true;
            }
        }
        return false;
    }
    function logGameState(action, move, extra = {}) {
        const info = [
            "---------------------------",
            `Snakes: ${board.snakes.length}`,
            `You: ${you.name} (id: ${you.id})`,
            `Health: ${you.health}`,
            `Length: ${you.length}`,
            `Head: (${you.head.x},${you.head.y})`,
            `Action: ${action}${move ? ` (${move})` : ""}`,
            ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
        ].join("\n");
        Deno.stdout.writeSync(new TextEncoder().encode(info + "\n"));
    }

    if (targets.length > 0 && you.health > 50) {
        for (const target of targets) {
            if (
                target.isSmallerSnake ||
                (target.isEqualSize && target.headDist <= 2)
            ) {
                const intercept = calculateInterceptionMove(
                    myHead,
                    target.head,
                    board,
                    you,
                );
                if (intercept) {
                    const nextHead = getNextHead(intercept.move);
                    if (
                        isSafe(intercept.move, nextHead) &&
                        !isImmediateSelfCollision(intercept.move)
                    ) {
                        logGameState(
                            "Intercept",
                            intercept.move,
                            { target: `(${target.head.x},${target.head.y})` },
                        );
                        return intercept.move;
                    }
                }
            }
        }
    }
    // a* implementation
    function aStarPath(start, goal) {
        const closed = new Set();
        const open = new Set();
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        const hazardCost = 10;

        function key(pos) {
            return `${pos.x},${pos.y}`;
        }

        function getHazardPenalty(pos) {
            if (
                board.hazards &&
                board.hazards.some((h) => h.x === pos.x && h.y === pos.y)
            ) {
                return hazardCost * (100 / you.health);
            }
            return 0;
        }

        const blocked = new Set();
        for (const snake of board.snakes) {
            for (const segment of snake.body) {
                blocked.add(key(segment));
            }
        }

        if (myBody.length > 1) {
            const myTail = myBody[myBody.length - 1];
            const nextMoveWillEatFood = food.some((f) =>
                f.x === goal.x && f.y === goal.y
            );
            if (!nextMoveWillEatFood) {
                blocked.delete(key(myTail));
            }
        }

        open.add(key(start));
        gScore[key(start)] = 0;
        fScore[key(start)] = Math.abs(start.x - goal.x) +
            Math.abs(start.y - goal.y) + getHazardPenalty(start);

        while (open.size > 0) {
            let currentKey = null;
            let minF = Infinity;
            for (const k of open) {
                if (fScore[k] !== undefined && fScore[k] < minF) {
                    minF = fScore[k];
                    currentKey = k;
                }
            }
            if (!currentKey) break;

            const [cx, cy] = currentKey.split(",").map(Number);
            const current = { x: cx, y: cy };

            if (current.x === goal.x && current.y === goal.y) {
                const path = [];
                let ck = currentKey;
                while (cameFrom[ck]) {
                    path.unshift(ck);
                    ck = cameFrom[ck];
                }
                path.unshift(key(start));
                return path.map((s) => {
                    const [x, y] = s.split(",").map(Number);
                    return { x, y };
                });
            }

            open.delete(currentKey);
            closed.add(currentKey);

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 },
            ];

            for (const neighbor of neighbors) {
                const nk = key(neighbor);
                if (
                    neighbor.x < 0 || neighbor.x >= width ||
                    neighbor.y < 0 || neighbor.y >= height ||
                    (blocked.has(nk) &&
                        !(neighbor.x === goal.x && neighbor.y === goal.y)) ||
                    closed.has(nk)
                ) {
                    continue;
                }

                const tentativeG = gScore[currentKey] + 1 +
                    getHazardPenalty(neighbor);
                if (!open.has(nk)) {
                    open.add(nk);
                } else if (tentativeG >= (gScore[nk] ?? Infinity)) {
                    continue;
                }

                cameFrom[nk] = currentKey;
                gScore[nk] = tentativeG;
                fScore[nk] = tentativeG + Math.abs(neighbor.x - goal.x) +
                    Math.abs(neighbor.y - goal.y);
            }
        }
        return null;
    }
    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;
        const trapMove = canTrapSnake(snake, myHead, board, you);
        if (trapMove) {
            const nextHead = getNextHead(trapMove);
            if (
                isSafe(trapMove, nextHead) &&
                !isImmediateSelfCollision(trapMove) &&
                !wouldTrapInOwnLoop(you, nextHead, board)
            ) {
                logGameState(
                    "Trap",
                    trapMove,
                    {
                        target: `(${snake.head.x},${snake.head.y})`,
                        snakeId: snake.id,
                    },
                );
                return trapMove;
            }
        }
    }

    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;
        const dx = Math.abs(myHead.x - snake.head.x);
        const dy = Math.abs(myHead.y - snake.head.y);
        if (dx + dy === 1 && you.length >= snake.length) {
            let interceptMove = null;
            if (myHead.x < snake.head.x) interceptMove = "right";
            else if (myHead.x > snake.head.x) interceptMove = "left";
            else if (myHead.y < snake.head.y) interceptMove = "up";
            else if (myHead.y > snake.head.y) interceptMove = "down";
            if (interceptMove) {
                const nextHead = getNextHead(interceptMove);
                if (
                    isSafe(interceptMove, nextHead) &&
                    !isImmediateSelfCollision(interceptMove) &&
                    !wouldTrapInOwnLoop(you, nextHead, board)
                ) {
                    logGameState(
                        "Intercept-HeadOn",
                        interceptMove,
                        {
                            target: `(${snake.head.x},${snake.head.y})`,
                            snakeId: snake.id,
                            winHeadOn: true
                        }
                    );
                    return interceptMove;
                }
            }
        }
    }

    let closestFood = null;
    let closestDist = Infinity;
    for (const f of food) {
        const dist = Math.abs(myHead.x - f.x) + Math.abs(myHead.y - f.y);
        if (dist < closestDist) {
            closestDist = dist;
            closestFood = f;
        }
    }
    if (closestFood) {
        function isFoodInStarvationLoop(foodPos, board, you) {
            const simulatedHead = { x: foodPos.x, y: foodPos.y };
            const simulatedBody = [simulatedHead, ...you.body];
            const blocked = new Set(
                simulatedBody.map((seg) => `${seg.x},${seg.y}`),
            );
            for (let x = -1; x <= board.width; x++) {
                blocked.add(`${x},-1`);
                blocked.add(`${x},${board.height}`);
            }
            for (let y = -1; y <= board.height; y++) {
                blocked.add(`-1,${y}`);
                blocked.add(`${board.width},${y}`);
            }
            const otherFood = (board.food || []).filter((f) =>
                f.x !== foodPos.x || f.y !== foodPos.y
            );
            if (otherFood.length === 0) return false;
            let canReachAny = false;
            for (const f of otherFood) {
                const visited = new Set();
                const queue = [simulatedHead];
                while (queue.length > 0) {
                    const pos = queue.shift();
                    const key = `${pos.x},${pos.y}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    if (pos.x === f.x && pos.y === f.y) {
                        canReachAny = true;
                        break;
                    }
                    for (
                        const dir of [
                            { x: 1, y: 0 },
                            { x: -1, y: 0 },
                            { x: 0, y: 1 },
                            { x: 0, y: -1 },
                        ]
                    ) {
                        const nx = pos.x + dir.x;
                        const ny = pos.y + dir.y;
                        const nkey = `${nx},${ny}`;
                        if (
                            nx >= 0 && nx < board.width &&
                            ny >= 0 && ny < board.height &&
                            !blocked.has(nkey) &&
                            !visited.has(nkey)
                        ) {
                            queue.push({ x: nx, y: ny });
                        }
                    }
                }
                if (canReachAny) break;
            }
            return !canReachAny;
        }

        if (isFoodInStarvationLoop(closestFood, board, you)) {
            logGameState(
                "SkipFood-StarveLoop",
                null,
                { food: `(${closestFood.x},${closestFood.y})` },
            );
        } else {
            let bestFood = null;
            let bestScore = -Infinity;
            for (const f of food) {
                const myDist = Math.abs(myHead.x - f.x) + Math.abs(myHead.y - f.y);
                let minEnemyDist = Infinity;
                for (const snake of board.snakes) {
                    if (snake.id === you.id) continue;
                    const dist = Math.abs(snake.head.x - f.x) + Math.abs(snake.head.y - f.y);
                    if (dist < minEnemyDist) minEnemyDist = dist;
                }
                let trapPenalty = 0;
                if (isFoodInStarvationLoop(f, board, you)) trapPenalty = 1000;
                let score = -myDist + Math.max(0, minEnemyDist - myDist) * 2 - trapPenalty;
                if (you.health < 40) score += 10 - myDist;
                if (score > bestScore) {
                    bestScore = score;
                    bestFood = f;
                }
            }
            const targetFood = bestFood || closestFood;
            const path = aStarPath(myHead, targetFood);
            if (path && path.length > 1) {
                const next = path[1];
                let move = null;
                if (next.y > myHead.y) move = "up";
                else if (next.y < myHead.y) move = "down";
                else if (next.x < myHead.x) move = "left";
                else if (next.x > myHead.x) move = "right";
                if (move) {
                    let avoidMove = false;
                    let baitedBy = null;
                    for (const snake of board.snakes) {
                        if (snake.id === you.id) continue;
                        if (snake.body.length > 1) {
                            const head = snake.head;
                            const neck = snake.body[1];
                            let snakeDir = null;
                            if (head.x === neck.x) {
                                snakeDir = head.y > neck.y ? "up" : "down";
                            } else if (head.y === neck.y) {
                                snakeDir = head.x > neck.x ? "right" : "left";
                            }
                            if (snakeDir === move) {
                                const snakeDist = Math.abs(head.x - targetFood.x) + Math.abs(head.y - targetFood.y);
                                const myDist = Math.abs(myHead.x - targetFood.x) + Math.abs(myHead.y - targetFood.y);
                                if (snakeDist <= myDist) {
                                    avoidMove = true;
                                    baitedBy = snake.id;
                                    break;
                                }
                            }
                        }
                    }
                    if (!calculateMove._prevPositions) calculateMove._prevPositions = [];
                    const prevPositions = calculateMove._prevPositions;
                    const nextHead = getNextHead(move);
                    let isOscillating = false;
                    if (prevPositions.length > 0) {
                        const prev = prevPositions[prevPositions.length - 1];
                        if (prev && prev.x === nextHead.x && prev.y === nextHead.y) {
                            isOscillating = true;
                        }
                    }
                    prevPositions.push({ x: myHead.x, y: myHead.y });
                    if (prevPositions.length > 4) prevPositions.shift();
                    if (avoidMove || isOscillating) {
                        const foodMoves = ["up", "down", "left", "right"].filter(m => m !== move);
                        let safeAlt = null;
                        let bestAltScore = -Infinity;
                        for (const altMove of foodMoves) {
                            const altNextHead = getNextHead(altMove);
                            const wasJustThere = prevPositions.some(p => p.x === altNextHead.x && p.y === altNextHead.y);
                            let altAvoid = false;
                            for (const snake of board.snakes) {
                                if (snake.id === you.id) continue;
                                if (snake.body.length > 1) {
                                    const head = snake.head;
                                    const neck = snake.body[1];
                                    let snakeDir = null;
                                    if (head.x === neck.x) {
                                        snakeDir = head.y > neck.y ? "up" : "down";
                                    } else if (head.y === neck.y) {
                                        snakeDir = head.x > neck.x ? "right" : "left";
                                    }
                                    if (snakeDir === altMove) {
                                        const snakeDist = Math.abs(head.x - targetFood.x) + Math.abs(head.y - targetFood.y);
                                        const myDist = Math.abs(myHead.x - targetFood.x) + Math.abs(myHead.y - targetFood.y);
                                        if (snakeDist <= myDist) {
                                            altAvoid = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            const distToFood = Math.abs(altNextHead.x - targetFood.x) + Math.abs(altNextHead.y - targetFood.y);
                            const progress = (Math.abs(myHead.x - targetFood.x) + Math.abs(myHead.y - targetFood.y)) - distToFood;
                            const isSafeAlt = !altAvoid && !wasJustThere && isSafe(altMove, altNextHead) && !isImmediateSelfCollision(altMove);
                            if (isSafeAlt && progress > 0 && progress >= bestAltScore) {
                                safeAlt = altMove;
                                bestAltScore = progress;
                            }
                        }
                        if (safeAlt) {
                            logGameState(
                                "A*-AvoidBait",
                                safeAlt,
                                {
                                    to: `(${getNextHead(safeAlt).x},${getNextHead(safeAlt).y})`,
                                    pathLen: path.length,
                                    eat: food.some(f => f.x === getNextHead(safeAlt).x && f.y === getNextHead(safeAlt).y) ? "yes" : "no",
                                    direction: safeAlt,
                                    baitedBy
                                }
                            );
                            return safeAlt;
                        }
                        logGameState(
                            "A*-BaitedOrLoop",
                            move,
                            {
                                to: `(${next.x},${next.y})`,
                                pathLen: path.length,
                                eat: food.some(f => f.x === next.x && f.y === next.y) ? "yes" : "no",
                                direction: move,
                                baitedBy,
                                oscillating: isOscillating
                            }
                        );
                        return move;
                    }
                    const nextHead2 = getNextHead(move);
                    const willEatFood = food.some((f) =>
                        f.x === nextHead.x && f.y === nextHead.y
                    );
                    let foodIsTrap = false;
                    if (willEatFood) {
                        const simulatedBody = [nextHead2, ...myBody];
                        const blocked = new Set();
                        for (const snake of board.snakes) {
                            for (const segment of snake.body) {
                                blocked.add(`${segment.x},${segment.y}`);
                            }
                        }
                        if (myBody.length > 1) {
                            const myTail = myBody[myBody.length - 1];
                            blocked.delete(`${myTail.x},${myTail.y}`);
                        }
                        const availableSpace = floodFill(
                            nextHead2,
                            blocked,
                            board,
                            simulatedBody,
                        );
                        const minSafe = Math.max(
                            myBody.length,
                            Math.floor(board.width * board.height / 6),
                        );
                        if (availableSpace < minSafe) {
                            foodIsTrap = true;
                        }
                    }
                    if (
                        isSafe(move, nextHead2) &&
                        !isImmediateSelfCollision(move) &&
                        isMoveSafe(move, board, you, nextHead2) &&
                        !foodIsTrap
                    ) {
                        logGameState(
                            "A*",
                            move,
                            {
                                to: `(${next.x},${next.y})`,
                                pathLen: path.length,
                                eat: willEatFood ? "yes" : "no",
                            },
                        );
                        return move;
                    } else if (foodIsTrap) {
                        logGameState(
                            "SkipFood-Trap",
                            null,
                            { food: `(${next.x},${next.y})` },
                        );
                    }
                }
            }
        }
    }

    let availableMoves = ["up", "down", "left", "right"];

    if (myBody.length > 1) {
        const neck = myBody[1];
        if (neck.x === myHead.x && neck.y === myHead.y - 1) {
            availableMoves = availableMoves.filter((m) => m !== "up");
        } else if (neck.x === myHead.x && neck.y === myHead.y + 1) {
            availableMoves = availableMoves.filter((m) => m !== "down");
        } else if (neck.x === myHead.x - 1 && neck.y === myHead.y) {
            availableMoves = availableMoves.filter((m) => m !== "left");
        } else if (neck.x === myHead.x + 1 && neck.y === myHead.y) {
            availableMoves = availableMoves.filter((m) => m !== "right");
        }
    }
    const safeMoves = availableMoves.filter((move) => {
        const nextHead = getNextHead(move);
        return isSafe(move, nextHead) && !isImmediateSelfCollision(move) &&
            !isNextTurnSelfCollision(move);
    });

    const analyzedMoves = safeMoves.map((move) => {
        const trapAnalysis = detectTrapAhead(board, you, move);
        return {
            move,
            ...trapAnalysis,
            nextHead: getNextHead(move),
        };
    });

    const safestMoves = analyzedMoves.filter((m) => !m.isTrap);
    if (safestMoves.length > 0) {
        const chosenMove =
            safestMoves[Math.floor(Math.random() * safestMoves.length)];
        logGameState(
            "SafeTrapFree",
            chosenMove.move,
            { to: `(${chosenMove.nextHead.x},${chosenMove.nextHead.y})` },
        );
        return chosenMove.move;
    }

    const moveWithBestEscape = analyzedMoves
        .filter((m) => m.escapeRoutes.length > 0)
        .sort((a, b) => b.escapeRoutes.length - a.escapeRoutes.length)[0];

    if (moveWithBestEscape) {
        logGameState(
            "EscapeTrap",
            moveWithBestEscape.move,
            {
                to: `(${moveWithBestEscape.nextHead.x},${moveWithBestEscape.nextHead.y})`,
                escapeRoutes: moveWithBestEscape.escapeRoutes.length,
            },
        );
        return moveWithBestEscape.move;
    }

    if (safeMoves.length > 0) {
        const nonDoomMoves = analyzedMoves.filter((m) =>
            !wouldTrapInOwnLoop(you, m.nextHead, board)
        );
        const bestMoveSet = nonDoomMoves.length > 0
            ? nonDoomMoves
            : analyzedMoves;

        const bestMove = bestMoveSet
            .sort((a, b) => b.availableSpace - a.availableSpace)[0];
        logGameState(
            "SafeMostSpace",
            bestMove.move,
            { to: `(${bestMove.nextHead.x},${bestMove.nextHead.y})` },
        );
        return bestMove.move;
    }

    const lastResortMoves = availableMoves.filter((move) => {
        const nextHead = getNextHead(move);
        return isSafe(move, nextHead);
    });

    if (lastResortMoves.length > 0) {
        if (safeMoves.length === 0 || safestMoves.length === 0) {
            const minimaxMove = minimaxAlphaBeta(
                board,
                you,
                myHead,
                myBody,
                3,
                true,
                -Infinity,
                Infinity,
            );
            if (minimaxMove) {
                logGameState(
                    "Minimax",
                    minimaxMove.move,
                    {
                        to: `(${minimaxMove.nextHead.x},${minimaxMove.nextHead.y})`,
                    },
                );
                return minimaxMove.move;
            }
        }
        const move =
            lastResortMoves[Math.floor(Math.random() * lastResortMoves.length)];
        logGameState(
            "LastResort",
            move,
        );
        return move;
    }

    if (you.shout && ["up", "down", "left", "right"].includes(you.shout)) {
        const nextHead = getNextHead(you.shout);
        if (
            ["up", "down", "left", "right"].includes(you.shout) &&
            isSafe(you.shout, nextHead)
        ) {
            logGameState(
                "Momentum",
                you.shout,
            );
            return you.shout;
        }
    }
    const fallbackMoves = ["up", "down", "left", "right"].filter((move) => {
        const nextHead = getNextHead(move);
        return isSafe(move, nextHead);
    });
    const move = fallbackMoves.length > 0
        ? fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)]
        : "down";
    logGameState(
        "Fallback",
        move,
    );
    return move;
}

/* function visualizeBoard(board, you, path = []) {
    const grid = Array(board.height).fill().map(() =>
        Array(board.width).fill("⬛")
    );
    const pathSet = new Set(path.map((pos) => `${pos.x},${pos.y}`));

    if (board.hazards) {
        for (const hazard of board.hazards) {
            grid[board.height - 1 - hazard.y][hazard.x] = "🔳";
        }
    }

    for (const snake of board.snakes) {
        const isYou = snake.id === you.id;
        for (let i = 0; i < snake.body.length; i++) {
            const segment = snake.body[i];
            grid[board.height - 1 - segment.y][segment.x] = isYou ? "🟦" : "🟨";
        }

        const head = snake.head;
        grid[board.height - 1 - head.y][head.x] = isYou ? "🟦" : "🟨";
    }    if (board.food) {
        for (const food of board.food) {
            grid[board.height - 1 - food.y][food.x] = "🟥";
        }
    }    for (const pos of path) {
        if (!board.food || !board.food.some((f) => f.x === pos.x && f.y === pos.y)) {
            grid[board.height - 1 - pos.y][pos.x] = "🟩";
        }
    }

    let boardStr = "\n";
    for (const row of grid) {
        boardStr += row.join("") + "\n";
    }

    return boardStr;
}
*/
// above is a vis, only for debug purposes

function floodFill(start, blockedSet, board, snakeBody, depth = 0) {
    const visited = new Set();
    const queue = [{ pos: start, depth }];
    const key = (pos) => `${pos.x},${pos.y}`;
    visited.add(key(start));

    const availableAtDepth = new Set();
    if (snakeBody && snakeBody.length > 0) {
        for (let i = 0; i < snakeBody.length; i++) {
            const segment = snakeBody[snakeBody.length - 1 - i];
            availableAtDepth.add(`${i}:${key(segment)}`);
        }
    }

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = [
            { x: current.pos.x + 1, y: current.pos.y },
            { x: current.pos.x - 1, y: current.pos.y },
            { x: current.pos.x, y: current.pos.y + 1 },
            { x: current.pos.x, y: current.pos.y - 1 },
        ];

        for (const neighbor of neighbors) {
            const nk = key(neighbor);
            if (
                neighbor.x >= 0 && neighbor.x < board.width &&
                neighbor.y >= 0 && neighbor.y < board.height &&
                !visited.has(nk)
            ) {
                const isBlocked = blockedSet.has(nk) &&
                    !availableAtDepth.has(`${current.depth}:${nk}`);

                if (!isBlocked) {
                    visited.add(nk);
                    queue.push({ pos: neighbor, depth: current.depth + 1 });
                }
            }
        }
    }

    return visited.size;
}

function isMoveSafe(move, board, you, nextHead) {
    const willEatFood = board.food &&
        board.food.some((f) => f.x === nextHead.x && f.y === nextHead.y);
    const simulatedBody = willEatFood ? [...you.body] : you.body.slice(0, -1);

    const blocked = new Set();

    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;
        for (const segment of snake.body) {
            blocked.add(`${segment.x},${segment.y}`);
        }
    }

    blocked.add(`${nextHead.x},${nextHead.y}`);

    const spaceNeeded = willEatFood ? you.length + 1 : you.length;

    const availableSpace = floodFill(nextHead, blocked, board, simulatedBody);

    if (
        availableSpace >= Math.min(spaceNeeded, board.width * board.height / 4)
    ) {
        return true;
    }

    return availableSpace >= spaceNeeded;
}

function detectTrapAhead(board, you, move) {
    const myHead = you.head;
    const nextHead = getNextHead(move);
    const simulatedBody = [...you.body];
    simulatedBody[0] = nextHead;

    const otherSnakes = board.snakes.filter((s) => s.id !== you.id);
    let potentialBlocks = new Set();

    for (const snake of otherSnakes) {
        for (const segment of snake.body) {
            potentialBlocks.add(`${segment.x},${segment.y}`);
        }
    }

    for (const snake of otherSnakes) {
        const possibleMoves = ["up", "down", "left", "right"]
            .map((dir) => {
                const pos = {
                    x: snake.head.x +
                        (dir === "left" ? -1 : dir === "right" ? 1 : 0),
                    y: snake.head.y +
                        (dir === "up" ? 1 : dir === "down" ? -1 : 0),
                };
                return pos;
            })
            .filter((pos) =>
                pos.x >= 0 && pos.x < board.width &&
                pos.y >= 0 && pos.y < board.height
            );

        for (const pos of possibleMoves) {
            potentialBlocks.add(`${pos.x},${pos.y}`);
        }
    }

    const availableSpace = floodFill(
        nextHead,
        potentialBlocks,
        board,
        simulatedBody,
    );
    const minSafeSpace = Math.min(
        you.length * 2,
        board.width * board.height / 4,
    );

    if (availableSpace < minSafeSpace) {
        const escapeRoutes = findEscapeRoutes(
            board,
            you,
            nextHead,
            potentialBlocks,
        );
        return {
            isTrap: true,
            escapeRoutes,
            availableSpace,
        };
    }

    return {
        isTrap: false,
        escapeRoutes: [],
        availableSpace,
    };
}

function findEscapeRoutes(board, you, position, blockedPositions) {
    const escapeRoutes = [];
    const visited = new Set();
    const queue = [{ pos: position, path: [position] }];
    visited.add(`${position.x},${position.y}`);

    const isEscapePoint = (pos) => {
        const spaceAvailable = floodFill(
            pos,
            blockedPositions,
            board,
            you.body,
        );
        return spaceAvailable >= you.length * 2;
    };

    while (queue.length > 0 && escapeRoutes.length < 3) {
        const current = queue.shift();

        if (isEscapePoint(current.pos)) {
            escapeRoutes.push(current.path);
            continue;
        }

        const neighbors = [
            { x: current.pos.x + 1, y: current.pos.y },
            { x: current.pos.x - 1, y: current.pos.y },
            { x: current.pos.x, y: current.pos.y + 1 },
            { x: current.pos.x, y: current.pos.y - 1 },
        ];

        for (const neighbor of neighbors) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (
                neighbor.x >= 0 && neighbor.x < board.width &&
                neighbor.y >= 0 && neighbor.y < board.height &&
                !visited.has(key) &&
                !blockedPositions.has(key)
            ) {
                visited.add(key);
                queue.push({
                    pos: neighbor,
                    path: [...current.path, neighbor],
                });
            }
        }
    }

    return escapeRoutes;
}

function minimaxAlphaBeta(
    board,
    you,
    myHead,
    myBody,
    depth,
    maximizing,
    alpha,
    beta,
) {
    const moves = ["up", "down", "left", "right"];
    let bestMove = null;
    let bestValue = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
        const nextHead = getNextHeadMinimax(myHead, move);
        if (!isSafeMinimax(move, nextHead, board, you, myBody)) continue;
        const willEatFood = board.food &&
            board.food.some((f) => f.x === nextHead.x && f.y === nextHead.y);
        const simulatedBody = willEatFood
            ? [nextHead, ...myBody]
            : [nextHead, ...myBody.slice(0, -1)];
        const value = minimaxRecursive(
            board,
            you,
            nextHead,
            simulatedBody,
            depth - 1,
            !maximizing,
            alpha,
            beta,
        );
        if (maximizing) {
            if (value > bestValue) {
                bestValue = value;
                bestMove = { move, nextHead };
            }
            alpha = Math.max(alpha, bestValue);
        } else {
            if (value < bestValue) {
                bestValue = value;
                bestMove = { move, nextHead };
            }
            beta = Math.min(beta, bestValue);
        }
        if (beta <= alpha) break;
    }
    return bestMove;
}

function minimaxRecursive(
    board,
    you,
    myHead,
    myBody,
    depth,
    maximizing,
    alpha,
    beta,
) {
    if (depth === 0) {
        return minimaxEval(board, you, myHead, myBody);
    }
    const moves = ["up", "down", "left", "right"];
    let bestValue = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
        const nextHead = getNextHeadMinimax(myHead, move);
        if (!isSafeMinimax(move, nextHead, board, you, myBody)) continue;
        const willEatFood = board.food &&
            board.food.some((f) => f.x === nextHead.x && f.y === nextHead.y);
        const simulatedBody = willEatFood
            ? [nextHead, ...myBody]
            : [nextHead, ...myBody.slice(0, -1)];
        const value = minimaxRecursive(
            board,
            you,
            nextHead,
            simulatedBody,
            depth - 1,
            !maximizing,
            alpha,
            beta,
        );
        if (maximizing) {
            bestValue = Math.max(bestValue, value);
            alpha = Math.max(alpha, bestValue);
        } else {
            bestValue = Math.min(bestValue, value);
            beta = Math.min(beta, bestValue);
        }
        if (beta <= alpha) break;
    }
    return bestValue;
}

function minimaxEval(board, you, myHead, myBody) {
    const blocked = new Set();
    for (const snake of board.snakes) {
        for (const segment of snake.body) {
            blocked.add(`${segment.x},${segment.y}`);
        }
    }
    const availableSpace = floodFill(myHead, blocked, board, myBody);
    let minDistToEnemy = Infinity;
    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;
        const dist = Math.abs(myHead.x - snake.head.x) +
            Math.abs(myHead.y - snake.head.y);
if (dist < minDistToEnemy) minDistToEnemy = dist;
    }

    const minDim = Math.min(board.width, board.height);
    let wallPenalty = 0;
    if (minDim <= 12) {
        const distToLeft = myHead.x;
        const distToRight = board.width - 1 - myHead.x;
        const distToBottom = myHead.y;
        const distToTop = board.height - 1 - myHead.y;
        const minWallDist = Math.min(
            distToLeft,
            distToRight,
            distToBottom,
            distToTop,
        );
        wallPenalty = (7 - minDim + 1) * (3 - minWallDist) * 10;
    }
    return availableSpace * 10 + minDistToEnemy - wallPenalty;
}

function getNextHeadMinimax(myHead, move) {
    const nextHead = { ...myHead };
    switch (move) {
        case "up":
            nextHead.y++;
            break;
        case "down":
            nextHead.y--;
            break;
        case "left":
            nextHead.x--;
            break;
        case "right":
            nextHead.x++;
            break;
    }
    return nextHead;
}

function isSafeMinimax(move, nextHead, board, you, myBody) {
    if (
        nextHead.x < 0 || nextHead.x >= board.width || nextHead.y < 0 ||
        nextHead.y >= board.height
    ) {
        return false;
    }
    const willEatFood = board.food &&
        board.food.some((f) => f.x === nextHead.x && f.y === nextHead.y);
    const simulatedBody = willEatFood ? myBody : myBody.slice(0, -1);
    if (
        simulatedBody.some((segment) =>
            nextHead.x === segment.x && nextHead.y === segment.y
        )
    ) {
        return false;
    }
    for (const snake of board.snakes) {
        if (snake.id === you.id) continue;
        if (
            snake.body.some((segment) =>
                nextHead.x === segment.x && nextHead.y === segment.y
            )
        ) {
            return false;
        }
    }
    return true;
}

function wouldTrapInOwnLoop(you, nextHead, board) {
    const willEatFood = board.food &&
        board.food.some((f) => f.x === nextHead.x && f.y === nextHead.y);
    const simulatedBody = willEatFood
        ? [nextHead, ...you.body]
        : [nextHead, ...you.body.slice(0, -1)];
    let surrounded = 0;
    for (
        const dir of [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ]
    ) {
        const nx = nextHead.x + dir.x;
        const ny = nextHead.y + dir.y;
        if (nx < 0 || nx >= board.width || ny < 0 || ny >= board.height) {
            surrounded++;
            continue;
        }
        if (
            simulatedBody.slice(1).some((seg) => seg.x === nx && seg.y === ny)
        ) {
            surrounded++;
        }
    }
    if (surrounded === 4) return true;
    const blocked = new Set(simulatedBody.map((seg) => `${seg.x},${seg.y}`));
    for (let x = -1; x <= board.width; x++) {
        blocked.add(`${x},-1`);
        blocked.add(`${x},${board.height}`);
    }
    for (let y = -1; y <= board.height; y++) {
        blocked.add(`-1,${y}`);
        blocked.add(`${board.width},${y}`);
    }
    const space = floodFill(nextHead, blocked, board, simulatedBody);
    if (space < you.length) return true;

    return false;
}
function canTrapSnake(snake, myHead, board, you) {
    if (snake.length > you.length) return false;
    const head = snake.head;
    let wallSides = 0;
    for (
        const dir of [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ]
    ) {
        const nx = head.x + dir.x;
        const ny = head.y + dir.y;
        if (nx < 0 || nx >= board.width || ny < 0 || ny >= board.height) {
            wallSides++;
        }
    }
    if (wallSides >= 2) {
        for (const move of ["up", "down", "left", "right"]) {
            const myNext = {
                x: myHead.x + (move === "left" ? -1 : move === "right" ? 1 : 0),
                y: myHead.y + (move === "up" ? 1 : move === "down" ? -1 : 0),
            };
            if (
                Math.abs(myNext.x - head.x) + Math.abs(myNext.y - head.y) ===
                    1 &&
                myNext.x >= 0 && myNext.x < board.width &&
                myNext.y >= 0 && myNext.y < board.height &&
                !board.snakes.some((s) =>
                    s.body.some((seg) =>
                        seg.x === myNext.x && seg.y === myNext.y
                    )
                )
            ) {
                let escapeCount = 0;
                for (
                    const dir of [
                        { x: 1, y: 0 },
                        { x: -1, y: 0 },
                        { x: 0, y: 1 },
                        { x: 0, y: -1 },
                    ]
                ) {
                    const ex = head.x + dir.x;
                    const ey = head.y + dir.y;
                    if (
                        ex >= 0 && ex < board.width &&
                        ey >= 0 && ey < board.height &&
                        !board.snakes.some((s) =>
                            s.body.some((seg) => seg.x === ex && seg.y === ey)
                        ) &&
                        !(ex === myNext.x && ey === myNext.y)
                    ) {
                        escapeCount++;
                    }
                }
                if (escapeCount <= 1) {
                    return move;
                }
            }
        }
    }
    const blocked = new Set();
    for (const s of board.snakes) {
        for (const seg of s.body) {
            blocked.add(`${seg.x},${seg.y}`);
        }
    }
    const enemySpace = floodFill(head, blocked, board, snake.body);
    if (enemySpace <= snake.length + 2) {
        for (const move of ["up", "down", "left", "right"]) {
            const myNext = {
                x: myHead.x + (move === "left" ? -1 : move === "right" ? 1 : 0),
                y: myHead.y + (move === "up" ? 1 : move === "down" ? -1 : 0),
            };
            if (
                Math.abs(myNext.x - head.x) + Math.abs(myNext.y - head.y) ===
                    1 &&
                myNext.x >= 0 && myNext.x < board.width &&
                myNext.y >= 0 && myNext.y < board.height &&
                !board.snakes.some((s) =>
                    s.body.some((seg) =>
                        seg.x === myNext.x && seg.y === myNext.y
                    )
                )
            ) {
                let exits = 0;
                for (
                    const dir of [
                        { x: 1, y: 0 },
                        { x: -1, y: 0 },
                        { x: 0, y: 1 },
                        { x: 0, y: -1 },
                    ]
                ) {
                    const ex = head.x + dir.x;
                    const ey = head.y + dir.y;
                    if (
                        ex >= 0 && ex < board.width &&
                        ey >= 0 && ey < board.height &&
                        !board.snakes.some((s) =>
                            s.body.some((seg) => seg.x === ex && seg.y === ey)
                        ) &&
                        !(ex === myNext.x && ey === myNext.y)
                    ) {
                        exits++;
                    }
                }
                if (exits === 0) {
                    return move;
                }
            }
        }
    }
    return false;
}
