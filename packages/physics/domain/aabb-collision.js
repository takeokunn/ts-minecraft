// Pure AABB block collision resolution.
// Separate-axis resolution order: Y first → X → Z (Y establishes correct floor/ceiling before
// horizontal axes run, preventing corner-climbing and step-up artifacts).
const EPSILON = 0.001;
// Integer block range for a player extent (with epsilon to avoid edge ambiguity)
function bMin(center, half) {
    return Math.floor(center - half + EPSILON);
}
function bMax(center, half) {
    return Math.floor(center + half - EPSILON);
}
export function resolveBlockCollisions(pos, velocity, halfW, // PLAYER_HALF_WIDTH = 0.3
halfH, // PLAYER_HALF_HEIGHT = 0.9
isBlockSolid) {
    let x = pos.x, y = pos.y, z = pos.z;
    let vx = velocity.x, vy = velocity.y, vz = velocity.z;
    let isGrounded = false;
    // ── Y axis ──────────────────────────────────────────────────────────────
    {
        const feetY = y - halfH;
        const headY = y + halfH;
        const bxMin = bMin(x, halfW);
        const bxMax = bMax(x, halfW);
        const bzMin = bMin(z, halfW);
        const bzMax = bMax(z, halfW);
        // Scan all Y levels in the player's bounding box (handles multi-block tunneling)
        const byLow = Math.floor(feetY);
        const byHigh = Math.floor(headY);
        let maxFloorY = Number.NEGATIVE_INFINITY;
        let minCeilY = Number.POSITIVE_INFINITY;
        for (let bx = bxMin; bx <= bxMax; bx++) {
            for (let bz = bzMin; bz <= bzMax; bz++) {
                for (let by = byLow; by <= byHigh; by++) {
                    if (isBlockSolid(bx, by, bz)) {
                        const blockTop = by + 1;
                        const blockBot = by;
                        // Player Y range overlaps this block?
                        if (headY > blockBot && feetY < blockTop) {
                            if (vy <= 0) {
                                // Moving down or stationary: this is a floor
                                if (blockTop > maxFloorY)
                                    maxFloorY = blockTop;
                            }
                            else {
                                // Moving up: this is a ceiling
                                if (blockBot < minCeilY)
                                    minCeilY = blockBot;
                            }
                        }
                    }
                }
            }
        }
        if (maxFloorY > Number.NEGATIVE_INFINITY) {
            y = maxFloorY + halfH;
            vy = 0;
            isGrounded = true;
        }
        if (minCeilY < Number.POSITIVE_INFINITY) {
            y = minCeilY - halfH;
            if (vy > 0)
                vy = 0;
        }
    }
    // ── X axis (use corrected Y) ─────────────────────────────────────────────
    {
        const byMin = bMin(y, halfH);
        const byMax = bMax(y, halfH);
        const bzMin = bMin(z, halfW);
        const bzMax = bMax(z, halfW);
        if (vx < 0) {
            const bxFace = Math.floor(x - halfW);
            outer: for (let by = byMin; by <= byMax; by++) {
                for (let bz = bzMin; bz <= bzMax; bz++) {
                    if (isBlockSolid(bxFace, by, bz)) {
                        x = bxFace + 1 + halfW;
                        vx = 0;
                        break outer;
                    }
                }
            }
        }
        else if (vx > 0) {
            const bxFace = Math.floor(x + halfW - EPSILON);
            outer: for (let by = byMin; by <= byMax; by++) {
                for (let bz = bzMin; bz <= bzMax; bz++) {
                    if (isBlockSolid(bxFace, by, bz)) {
                        x = bxFace - halfW;
                        vx = 0;
                        break outer;
                    }
                }
            }
        }
    }
    // ── Z axis (use corrected Y and X) ──────────────────────────────────────
    {
        const byMin = bMin(y, halfH);
        const byMax = bMax(y, halfH);
        const bxMin = bMin(x, halfW);
        const bxMax = bMax(x, halfW);
        if (vz < 0) {
            const bzFace = Math.floor(z - halfW);
            outer: for (let by = byMin; by <= byMax; by++) {
                for (let bx = bxMin; bx <= bxMax; bx++) {
                    if (isBlockSolid(bx, by, bzFace)) {
                        z = bzFace + 1 + halfW;
                        vz = 0;
                        break outer;
                    }
                }
            }
        }
        else if (vz > 0) {
            const bzFace = Math.floor(z + halfW - EPSILON);
            outer: for (let by = byMin; by <= byMax; by++) {
                for (let bx = bxMin; bx <= bxMax; bx++) {
                    if (isBlockSolid(bx, by, bzFace)) {
                        z = bzFace - halfW;
                        vz = 0;
                        break outer;
                    }
                }
            }
        }
    }
    return { position: { x, y, z }, velocity: { x: vx, y: vy, z: vz }, isGrounded };
}
//# sourceMappingURL=../../../dist/packages/physics/domain/aabb-collision.js.map