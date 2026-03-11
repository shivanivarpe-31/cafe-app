import { useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

/**
 * Global hook that polls for kitchen-ready orders (PREPARING + all items DONE)
 * and plays a notification sound from any page.
 * Only active for ADMIN and MANAGER roles.
 */
const useKitchenReadyAlert = () => {
    const { user } = useAuth();
    const previousReadyIdsRef = useRef(new Set());
    const isFirstLoadRef = useRef(true);
    const audioContextRef = useRef(null);
    const intervalRef = useRef(null);

    const playReadySound = useCallback(() => {
        try {
            if (
                !audioContextRef.current ||
                audioContextRef.current.state === "closed"
            ) {
                audioContextRef.current = new (window.AudioContext ||
                    window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === "suspended") ctx.resume();

            const playTone = (freq, startTime) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = "sine";
                gain.gain.setValueAtTime(0.5, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
                osc.start(startTime);
                osc.stop(startTime + 0.4);
            };
            playTone(880, ctx.currentTime);
            playTone(1100, ctx.currentTime + 0.25);
        } catch (e) {
            // Ignore audio errors
        }
    }, []);

    const checkKitchenReady = useCallback(async () => {
        try {
            const res = await axios.get("/api/orders");
            const orders = res.data.data || res.data;

            const kitchenReadyIds = new Set(
                orders
                    .filter(
                        (o) =>
                            o.status === "PREPARING" &&
                            o.items?.length > 0 &&
                            o.items.every((item) => item.prepStatus === "DONE"),
                    )
                    .map((o) => o.id),
            );

            if (!isFirstLoadRef.current) {
                const hasNew = [...kitchenReadyIds].some(
                    (id) => !previousReadyIdsRef.current.has(id),
                );
                if (hasNew) {
                    playReadySound();
                }
            }

            isFirstLoadRef.current = false;
            previousReadyIdsRef.current = kitchenReadyIds;
        } catch {
            // Silently ignore — don't disrupt the user
        }
    }, [playReadySound]);

    useEffect(() => {
        // Only run for admin/manager roles
        if (!user || !["admin", "manager", "ADMIN", "MANAGER"].includes(user.role)) {
            return;
        }

        // Initial check
        checkKitchenReady();

        // Poll every 10 seconds
        intervalRef.current = setInterval(checkKitchenReady, 10000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                audioContextRef.current.close().catch(() => { });
            }
        };
    }, [user, checkKitchenReady]);
};

export default useKitchenReadyAlert;
