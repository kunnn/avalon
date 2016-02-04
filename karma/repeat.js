var assert = chai.assert;
var expect = chai.expect
function heredoc(fn) {
    return fn.toString().replace(/^[^\/]+\/\*!?\s?/, '').
            replace(/\*\/[^\/]+$/, '').trim().replace(/>\s*</g, "><")
}
function fireClick(el) {
    if (el.click) {
        el.click()
    } else {
//https://developer.mozilla.org/samples/domref/dispatchEvent.html
        var evt = document.createEvent("MouseEvents")
        evt.initMouseEvent("click", true, true, window,
                0, 0, 0, 0, 0, false, false, false, false, 0, null);
        !el.dispatchEvent(evt);
    }
}
describe('repeat', function () {
    var body = document.body, div, vm
    beforeEach(function () {
        div = document.createElement("div")
        body.appendChild(div)
    })
    afterEach(function () {
        body.removeChild(div)
        delete avalon.vmodels[vm.$id]
    })
    it("test", function (done) {
        div.innerHTML = heredoc(function () {
            /*
             <div ms-controller="repeat0">
             <ul>
             <li ms-repeat="array">{{el}}-{{$first}}-{{$last}}-{{$index}}</li>
             </ul>
             </div>
             */
        })
        vm = avalon.define({
            $id: 'repeat0',
            array: [1, 2, 3, 4]
        })
        avalon.scan(div, vm)
        var lis = div.getElementsByTagName("li")
        expect(lis.length).to.equal(4)
        expect(lis[0].innerHTML).to.equal("1-true-false-0")
        expect(lis[1].innerHTML).to.equal("2-false-false-1")
        expect(lis[2].innerHTML).to.equal("3-false-false-2")
        expect(lis[3].innerHTML).to.equal("4-false-true-3")

        vm.array.push(5)
        setTimeout(function () {

            lis = div.getElementsByTagName("li")
            expect(lis.length).to.equal(5)
            expect(lis[3].innerHTML).to.equal("4-false-false-3")
            expect(lis[4].innerHTML).to.equal("5-false-true-4")
            vm.array.reverse()
            setTimeout(function () {
                expect(lis[0].innerHTML).to.equal("5-true-false-0")
                expect(lis[1].innerHTML).to.equal("4-false-false-1")
                expect(lis[2].innerHTML).to.equal("3-false-false-2")
                expect(lis[3].innerHTML).to.equal("2-false-false-3")
                expect(lis[4].innerHTML).to.equal("1-false-true-4")
                vm.array.shift()
                vm.array.unshift("a")
                vm.array.pop()
                vm.array.remove(3)
                setTimeout(function () {
                    expect(lis[0].innerHTML).to.equal("a-true-false-0")
                    expect(lis[1].innerHTML).to.equal("4-false-false-1")
                    expect(lis[2].innerHTML).to.equal("2-false-true-2")
                    done()
                }, 100)
            }, 100)
        }, 100)


    })
    it("test2", function (done) {
        div.innerHTML = heredoc(function () {
            /*
             <div ms-controller="repeat1">
             <select multiple="true" ms-each="array">
             <option>{{el.a}}</option>
             </select>
             <p ms-repeat="array">{{el.a+222}}</p>
             
             </div>
             */
        })
        vm = avalon.define({
            $id: 'repeat1',
            array: [{a: 11}, {a: 22}, {a: 33}]
        })
        avalon.scan(div, vm)
        var options = div.getElementsByTagName("option")
        expect(options[0].text).to.equal("11")
        expect(options[1].text).to.equal("22")
        expect(options[2].text).to.equal("33")
        avalon.each(options, function (i, el) {
            el.title = el.text
        })
        var ps = div.getElementsByTagName("p")
        var prop = "textContent" in div ? "textContent" : "innerText"
        expect(ps[0][prop]).to.equal("233")
        expect(ps[1][prop]).to.equal("244")
        expect(ps[2][prop]).to.equal("255")
        avalon.each(ps, function (i, el) {
            el.title = el[prop]
        })
        vm.array.reverse()
        setTimeout(function () {
            expect(options[0].text).to.equal("33")
            expect(options[1].text).to.equal("22")
            expect(options[2].text).to.equal("11")
            expect(options[0].title).to.equal("33")
            expect(options[1].title).to.equal("22")
            expect(options[2].title).to.equal("11")
            expect(ps[0][prop]).to.equal("255")
            expect(ps[1][prop]).to.equal("244")
            expect(ps[2][prop]).to.equal("233")
            expect(ps[0].title).to.equal("255")
            expect(ps[1].title).to.equal("244")
            expect(ps[2].title).to.equal("233")
            vm.array = [{a: 66}, {a: 77}, {a: 88}, {a: 99}]
            setTimeout(function () {
                expect(options[0].text).to.equal("66")
                expect(options[1].text).to.equal("77")
                expect(options[2].text).to.equal("88")
                expect(options[3].text).to.equal("99")
                expect(options[0].title).to.equal("33")
                expect(options[1].title).to.equal("22")
                expect(options[2].title).to.equal("11")
                expect(options[3].title).to.equal("")


                expect(ps[0][prop]).to.equal("288")
                expect(ps[1][prop]).to.equal("299")
                expect(ps[2][prop]).to.equal("310")
                expect(ps[3][prop]).to.equal("321")
                expect(ps[0].title).to.equal("255")
                expect(ps[1].title).to.equal("244")
                expect(ps[2].title).to.equal("233")
                expect(ps[3].title).to.equal("")
                done()
            })
        })

    })

})