/** Runs only the last callback requested during a batch. */
export class Batch {
	/** Tracks nested batch runs. */
	private activeRuns = 0;
	/** The last pending callback wins. Cleanup itself on call. */
	private pendingCallback?: () => void;

	/**
	 * Runs work and handles the last request when the outermost run ends.
	 *
	 * @param work Work to run synchronously inside the batch.
	 */
	run(work: () => void): void {
		this.activeRuns++;

		try {
			work();
		} finally {
			this.activeRuns--;

			if (this.activeRuns === 0) this.pendingCallback?.();
		}
	}

	/**
	 *  Request the callback now, or replaces the pending callback inside a run.
	 *
	 * @param callback Callback to run after the batch completes.
	 */
	request(callback: () => void): void {
		if (this.activeRuns > 0) {
			this.pendingCallback = () => {
				this.pendingCallback = undefined;

				callback();
			};
		} else callback();
	}
}
