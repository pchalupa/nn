/**
 * Object that reports its events to a single delegate, unlike an `Observable`.
 *
 * @example
 * interface UploadDelegate {
 * 	uploadDidFinish(url: string): void;
 * }
 *
 * class Upload implements Delegatable<UploadDelegate> {
 * 	public delegate?: UploadDelegate;
 *
 * 	private finish(url: string): void {
 * 		this.delegate?.uploadDidFinish(url);
 * 	}
 * }
 */
export interface Delegatable<Delegate> {
	delegate?: Delegate;
}
