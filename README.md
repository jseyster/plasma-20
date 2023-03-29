# Twentieth Anniversary of the Plasma Fractal Applet

Thank you for your interest in the 20th anniversary release of one of my first
programming projects. It's been a minute since I first put together [some code
to learn how plasma fractals](https://github.com/jseyster/plasmafractal) work,
and two decades later, I relived my early programming years by reimplementing
the project in a more modern Web environment.

I didn't feel like I had overcomplicated the project sufficiently to reflect my
many years of professional experience, however. Also, it's kinda slow.

## Next steps

This is where I was [going to complain](https://github.com/jseyster/plasmafractal/tree/master/plasma-js#performance)
about JavaScript performance, but to be honest, I didn't really try to make it
fast, so maybe it's my fault. Optimizing JavaScript didn't sound fun, so I
immediately blamed the language and reached for the _big guns_.

## GPU-accelerated plasma fractal computation

Is there any utility to computing the diamond square algorithm on a GPU? If you
can think of any, then you'll be pleased to see that I've implemented exactly
that. The important thing is that I got to play with the really cool toys.

## Performance results

I'm guessing it's a _lot_ faster, but most browsers cap their frame rate at 60
FPS, so the best I can tell you is that total render time is less than 17ms.

|                           |             |
| ------------------------- | ----------: |
| Poorly written JavaScript |       220ms |
| Poorly written GLSL       | 17ms? Less? |
| Speedup                   |        13X? |

I know even less about optimizing GPU shaders than I do about optimizing
JavaScript, so this speedup confirms my original thesis that I can blame all my
terrible performance on the language I'm using and that GPUs are really cool.

In 2042, I'll post how much faster a quantum computer can run this algorithm and
complain about whatever language is popular by then, which will probably be even
more inefficient.

## Acknowledgments

Thanks to @jaames for [iro.js](https://iro.js.org), a gorgeous color picker that
is the Fran Fine to the diamond square algorithm's stodgy Maxwell Sheffield.
