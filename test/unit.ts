const obj = {
    a: {
        b: 1
    }
}

const proxy = new Proxy(structuredClone(obj), {})

proxy.a.b = 2

console.log(obj)