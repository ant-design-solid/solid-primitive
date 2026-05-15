import { createRoot } from 'solid-js'

export const withRoot = async <T>(run: () => Promise<T> | T) =>
  new Promise<T>((resolve, reject) => {
    createRoot(dispose => {
      try {
        Promise.resolve(run()).then(
          value => {
            dispose()
            resolve(value)
          },
          error => {
            dispose()
            reject(error)
          },
        )
      } catch (error) {
        dispose()
        reject(error)
      }
    })
  })
