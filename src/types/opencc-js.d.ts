/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
declare module 'opencc-js' {
  export function Converter(opts: { from: string; to: string }): (input: string) => string
}
