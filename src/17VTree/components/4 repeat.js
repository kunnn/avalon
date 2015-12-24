avalon.directive("repeat", {
    is: function (a, b) {
        if (Array.isArray(a)) {

            if (!Array.isArray(b))
                return false
            if (a.length !== b.length) {
                return false
            }

            return !a.some(function (el, i) {
                return el !== b[i]
            })
        } else {
            return compareObject(a, b)
        }
    },
    init: function (binding) {
        var parent = binding.element
        disposeVirtual(parent.children)
        var component = new VComponent("ms-repeat")
        var template = toString(parent, {
            "ms-repeat": true,
            "avalon-uuid": true
        })
        var arr = binding.siblings
        for (var i = 0, el; el = arr[i]; i++) {
            if (el === parent) {
                arr[i] = component
                break
            }
        }

        delete binding.siblings
        binding.element = component //偷龙转风

        var type = binding.type
        component.itemName = binding.param || "el"
        var signature = generateID(type)
        component.signature = signature
        component["data-" + type + "-rendered"] = parent.props["data-" + type + "-rendered"]
        component.children.length = 0 //将父节点作为它的子节点
        if (type === "each") {
            component.template = parent.template.trim() + "<!--" + signature + "-->"
            pushArray(parent.children, [component])
            return false
        }
        component.template = template + "<!--" + signature + "-->"
        return false
    },
    change: function (value, binding) {

        var parent = binding.element
        var cache = binding.cache || {}
        var newCache = {}
        var children = []
        var last = value.length - 1
        //遍历监控数组的VM或简单数据类型
        var needDispose = [], proxy
        var command = {}
        //键名为它过去的位置
        //键值如果为数字,表示它将移动到哪里,-1表示它将移除,-2表示它将创建,-3不做处理
        for (var i = 0; i <= last; i++) {
            var vm = value[i]
            var component = isInCache(cache, vm)
            if (component) {
                proxy = component.vmodel
                if (proxy.$index !== i) {
                    command[proxy.$index] = i
                } else {
                    command[proxy.$index] = -3
                }
            } else {
                component = new VComponent("repeatItem")
                component.template = parent.template
                component.itemName = binding.param || "el"
                component.construct({vmodel: vm, top: binding.vmodel, array: value})
                component.index = i
                proxy = component.vmodel
                command[i] = -2
            }
            proxy.$index = i
            proxy.$first = i === 0
            proxy.$last = i === last
            if (component._new) {
                updateVirtual(component.children, proxy)
                delete component._new
            }
            saveInCache(newCache, vm, component)
            children.push(component)
        }

        for (i in cache) {//剩下的都是要删除重复利用的
            if (cache[i]) {
                command[cache[i].vmodel.$index] = -1
                needDispose.push(cache[i])
                delete cache[i]
            }
        }

        disposeVirtual(needDispose) //销毁没有用的组件
        parent.children.length = 0
        pushArray(parent.children, children)
        parent.children.unshift(new VComment(parent.signature + ":start"))
        parent.children.push(new VComment(parent.signature + ":end"))
        binding.cache = newCache
        binding.oldValue = value.concat()
        parent.repeatCommand = command
        addHooks(this, binding)
    },
    update: function (elem, vnode, parent) {
        var next
        if (!vnode.disposed) {
            var groupText = vnode.signature
            if (elem.nodeType !== 8 && elem.nodeValue !== groupText + ":start") {
                var dom = vnode.toDOM()
                var keepChild = avalon.slice(dom.childNodes)
                parent.replaceChild(dom, elem)
                updateEntity(keepChild, getRepeatChild(vnode.children))
            } else {
                var breakText = groupText + ":end"
                var fragment = document.createDocumentFragment()
                //将原有节点移出DOM, 试根据groupText分组
                var froms = {}
                var index = 0
                while (next = elem.nextSibling) {
                    if (next.nodeValue === breakText) {
                        break
                    } else if (next.nodeValue === groupText) {
                        fragment.appendChild(next)
                        froms[index] = fragment
                        index++
                        fragment = document.createDocumentFragment()
                    } else {
                        fragment.appendChild(next)
                    }
                }
                //根据repeatCommand指令进行删增重排
                var children = []
                for (var from in vnode.repeatCommand) {
                    var to = vnode.repeatCommand[from]
                    if (to >= 0) {
                        children[to] = froms[from]
                    } else if (to === -3) {
                        children[from] = froms[from]
                    }
                }

                fragment = document.createDocumentFragment()
                for (var i = 0, el; el = children[i++]; ) {
                    fragment.appendChild(el)
                }

                var entity = avalon.slice(fragment.childNodes)
                elem.parentNode.insertBefore(fragment, elem.nextSibling)
                var virtual = []
                vnode.children.forEach(function (el) {
                    pushArray(virtual, el.children)
                })
                updateEntity(entity, virtual)
            }
        }
        return false
    },
    old: function (binding, oldValue) {
        if (Array.isArray(oldValue)) {
            // binding.oldValue = oldValue.concat()
        } else {
            var o = binding.oldValue = {}
            for (var i in oldValue) {
                if (oldValue.hasOwnProperty(i)) {
                    o[i] = oldValue[i]
                }
            }
        }
    }
})

var repeatItem = avalon.components["repeatItem"] = {
    construct: function (options) {
        var top = options.top
        if (options.vmodel && options.vmodel.$id) {
            top = createProxy(top, options.vmodel)
        }
        var itemName = this.itemName
        var proxy = createRepeatItem(top, itemName, options.array)
        proxy[itemName] = options.vmodel

        this.vmodel = proxy
        this.children = createVirtual(this.template, true)
        this._new = true
        this.updateProxy = repeatItem.updateProxy
        return this
    },
    updateProxy: function (options) {
        var vm = this.vmodel
        vm[this.itemName] = vm
        for (var i in options.vm) {
            vm[i] = options.vm[i]
        }
    }
}

function createRepeatItem(curVm, itemName, array) {
    var heirloom = {}
    var before = Object(curVm) === curVm ? curVm : {}
    var after = {
        $accessors: {
            $first: makeObservable("first", heirloom),
            $last: makeObservable("$last", heirloom),
            $index: makeObservable("$index", heirloom)
        },
        $first: 1,
        $last: 1,
        $index: 1
    }
    if (array) {
        after.$remove = function () {
            avalon.Array.remove(array, curVm)
        }
    }
    after[itemName] = 1
    after.$accessors[itemName] = makeObservable(itemName, heirloom)
    var proxy = createProxy(before, after, heirloom)
    return proxy
}
function getRepeatChild(children) {
    var ret = []
    for (var i = 0, el; el = children[i++]; ) {
        if (el.__type__ === "repeatItem") {
            pushArray(ret, el.children)
        } else {
            ret.push(el)
        }
    }
    return ret
}
//avalon.test.createRepeatItem = createRepeatItem

avalon.components["ms-each"] = avalon.components["ms-repeat"]

function removeItems(array) {
    array.forEach(function (el) {
        el.$active = false
    })
}


function compareObject(a, b) {

    var atype = avalon.type(a)
    var btype = avalon.type(a)
    if (atype === btype) {
        var aisVM = atype === "object" && a.$id
        var bisVM = btype === "object"
        var hasDetect = {}
        if (aisVM && bisVM) {
            for (var i in a) {
                hasDetect[i] = true
                if ($$skipArray[i])
                    continue
                if (a.hasOwnProperty(i)) {
                    if (!b.hasOwnProperty(i))
                        return false //如果a有b没有
                    if (!compareObject(a[i], b[i]))
                        return false
                }
            }
            for (i in b) {
                if (hasDetect[i]) {
                    continue
                }//如果b有a没有
                return false
            }
            return true
        } else {
            if (btype === "date")
                return a + 0 === b + 0
            return a === b
        }
    } else {
        return false
    }
}
function isInCache(cache, vm) {
    var isObject = Object(vm) === vm, c
    if (isObject) {
        c = cache[vm.$id]
        if (c) {
            delete cache[vm.$id]
        }
        return c
    } else {
        var id = avalon.type(vm) + "_" + vm
        c = cache[id]
        if (c) {
            var stack = [{id: id, c: c}]
            while (1) {
                id += "_"
                if (cache[id]) {
                    stack.push({
                        id: id,
                        c: cache[id]
                    })
                } else {
                    break
                }
            }
            var a = stack.pop()
            delete cache[a.id]
            return a.c
        }
        return c
    }
}

function saveInCache(cache, vm, component) {
    if (Object(vm) === vm) {
        cache[vm.$id] = component
    } else {
        var type = avalon.type(vm)
        var trackId = type + "_" + vm
        if (!cache[trackId]) {
            cache[trackId] = component
        } else {
            while (1) {
                trackId += "_"
                if (!cache[trackId]) {
                    cache[trackId] = component
                    break
                }
            }
        }
    }
}