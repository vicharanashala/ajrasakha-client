import { act, render, screen } from '@testing-library/react';
import AjraSakhaProgressStatus, {
  AJRASAKHA_REPEATING_PROGRESS_MESSAGE,
} from './AjraSakhaProgressStatus';

describe('AjraSakhaProgressStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows each configured status before repeating the final status every 30 seconds', () => {
    render(<AjraSakhaProgressStatus />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '⏳ Your request is being processed. This usually takes around 10–20 seconds.',
    );

    act(() => jest.advanceTimersByTime(5_000));
    expect(screen.getByRole('status')).toHaveTextContent(
      '🧠 Still working on your request. Thanks for your patience.',
    );

    act(() => jest.advanceTimersByTime(55_000));
    expect(screen.getByRole('status')).toHaveTextContent(
      "🔄 I'm still processing your request. Complex requests can occasionally take up to a minute or more.",
    );

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_REPEATING_PROGRESS_MESSAGE);

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('status')).toHaveTextContent(AJRASAKHA_REPEATING_PROGRESS_MESSAGE);
  });

  it('clears its timers when the pending response placeholder unmounts', () => {
    const { unmount } = render(<AjraSakhaProgressStatus />);
    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
