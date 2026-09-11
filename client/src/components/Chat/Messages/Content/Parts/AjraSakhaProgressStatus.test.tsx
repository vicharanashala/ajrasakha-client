import { act, render, screen } from '@testing-library/react';
import AjraSakhaProgressStatus, {
  AJRASAKHA_INITIAL_MESSAGE,
  AJRASAKHA_LONG_WAIT_UPDATES,
  AJRASAKHA_TIPS,
} from './AjraSakhaProgressStatus';

describe('AjraSakhaProgressStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the opening message, then hands over to the tips and cycles them', () => {
    render(<AjraSakhaProgressStatus />);

    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_INITIAL_MESSAGE);

    act(() => jest.advanceTimersByTime(6_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_TIPS[0]);
    expect(screen.getByRole('status')).not.toHaveTextContent(AJRASAKHA_INITIAL_MESSAGE);

    act(() => jest.advanceTimersByTime(8_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_TIPS[1]);
  });

  it('wraps back to the first tip after the last one', () => {
    render(<AjraSakhaProgressStatus />);

    act(() => jest.advanceTimersByTime(6_000 + 8_000 * AJRASAKHA_TIPS.length));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_TIPS[0]);
  });

  it('interrupts the tips with a reassurance at each long-wait mark', () => {
    render(<AjraSakhaProgressStatus />);

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_LONG_WAIT_UPDATES[0].message);

    // ...and hands back to the tips once it has been on screen long enough to read.
    act(() => jest.advanceTimersByTime(8_000));
    expect(screen.getByRole('status')).not.toHaveTextContent(
      AJRASAKHA_LONG_WAIT_UPDATES[0].message,
    );

    act(() => jest.advanceTimersByTime(22_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_LONG_WAIT_UPDATES[1].message);
  });

  it('clears its timers when the pending response placeholder unmounts', () => {
    const { unmount } = render(<AjraSakhaProgressStatus />);
    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
