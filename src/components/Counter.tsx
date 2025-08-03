interface CounterProps {
  count: number
  onIncrement: () => void
}

export function Counter({ count, onIncrement }: CounterProps) {
  return (
    <div className="card">
      <button onClick={onIncrement}>
        count is {count}
      </button>

      <p>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
    </div>
  )
} 