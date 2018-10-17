const R = document.createRange()

export default class NodeTemplate {
    constructor(tagText, options) {
        if(typeof tagText !== "string"){
            throw new Error("You need to provide a HTML/XML/SVG String as first parameter.")
        }
        this.version = "3.0.1-7"

        this.text = cleanInputString(tagText, { removeComments: true })
        try {
            this.fragment = R.createContextualFragment(this.text)
        } catch(error){
            throw error
        }
     
        // add node references
        const { root, refs, ids } = getNodeReferences(this.fragment, options)
        this.root = root
        this.refs = refs
        this.ids = ids
    }
    destroy(){
        // perf: use for-in
        // proof: https://jsperf.com/object-iteration-bench
        let refs = this.refs
        if(refs){
            for(let k in refs){
                this.refs[k].remove()
            }
            delete this.refs
        }

        let ids = this.ids
        if(ids){
            for(let k in ids){
                this.ids[k].remove()
            }
            delete this.ids
        }

        let root = this.root
        if(root){
            if(root instanceof Array){
                for(let k in root){
                    this.root[k].remove()
                }
            } else {
                this.root.remove()
            }
            delete this.root
        }
    }
}

function detectComment(text){
    // empty
}
function cleanInputString(text, options = {}){
    let { removeComments } = options
    
    // perf: string methods (split, fast for)
    // proof: https://jsperf.com/node-template-string-cleanup-remove-comments
    if(removeComments){
        let lines = text.split("\n")
        for(let i = lines.length; i--;){
            let position = lines[i].indexOf("//")
            let found = (position !== -1)
            if(found){
                if(position > 0){
                    // skip 'https://' and 'file:///'
                    let precedingChar = lines[i].charAt(position - 1)
                    let followingChar = lines[i].charAt(position + 2)
                    let subPosition = null
                    while(precedingChar === ":"){
                        if(followingChar === "/"){
                            // continue search in substring
                            position += 3
                            subPosition = lines[i].substring(position).indexOf("//")                
                        } else {
                            // continue search in substring
                            position += 2
                            subPosition = lines[i].substring(position).indexOf("//")                
                        }
                        found = (subPosition !== -1)
                        if(found){
                            // repeat
                            position += subPosition
                            precedingChar = lines[i].charAt(position - 1)
                            followingChar = lines[i].charAt(position + 2)   
                        } else {
                            // while-loop: nothing found => finish search
                            break
                        }
                    }
                    // for-loop: nothing found after detecting https:// or file:/// => next line
                    if(!found){
                        continue
                    }
                }
                // remove comment
                lines[i] = lines[i].substring(0, position)
            }
        }
        text = lines.join("\n")
    }

    // perf: substring loop
    // proof: https://jsperf.com/node-template-string-cleanup-complex
    let index = 0
    let found = false
    let removeSpaceBeforeOffsetOne = false
    let removeSpaceAfterOffsetTwo = false
    let removeSpaceAfterOffsetThree = false
    do {
        removeSpaceBeforeOffsetOne = (index = text.indexOf("\n")) !== -1
            || (index = text.indexOf("\t")) !== -1
            || (index = text.indexOf("  ")) !== -1
            || (index = text.indexOf(" <")) !== -1
            || (index = text.indexOf(" >")) !== -1
            || (index = text.indexOf(" />")) !== -1
            || (index = text.indexOf(" '")) !== -1
            || (index = text.indexOf(" \"")) !== -1
            || (index = text.indexOf(" (")) !== -1
            || (index = text.indexOf(" )")) !== -1
            || (index = text.indexOf(" ,")) !== -1
            || (index = text.indexOf(" ;")) !== -1
        if(removeSpaceBeforeOffsetOne){
            // target-offset = 1
            text = text.substring(0, index) + text.substring(index + 1)
        }

        removeSpaceAfterOffsetTwo = (index = text.indexOf("< ")) !== -1
            || (index = text.indexOf("> ")) !== -1
            || (index = text.indexOf("( ")) !== -1
            || (index = text.indexOf("= \"")) !== -1
        if(removeSpaceAfterOffsetTwo){
            // target-offset = 2
            text = text.substring(0, index + 1) + text.substring(index + 2)
        }

        removeSpaceAfterOffsetThree = (index = text.indexOf("</ ")) !== -1
            || (index = text.indexOf("=\" ")) !== -1
            || (index = text.indexOf(")\" >")) !== -1
        if(removeSpaceAfterOffsetThree){
            // target-offset = 3
            text = text.substring(0, index + 2) + text.substring(index + 3)
        }

        found = removeSpaceBeforeOffsetOne || removeSpaceAfterOffsetTwo || removeSpaceAfterOffsetThree
    } while(found)

    return text
}
function cleanInputString_old(tagText, options = {}){
    let { removeComments } = options
    
    if(removeComments){
        // remove js line comments.
        tagText = tagText.replace(/\s*(?<![\:\/])\/{2}.*$/gm, "")
    }

    // remove all newlines, tabs and returns from the tagText string to create one line
    // regex: [\n\t\r]
    // subst: null
    tagText = tagText.replace(/[\n\t\r]/g, "")

    // style multiline specific:
    // ------------------------------------------------------------------
    // remove all spaces > 2 
    // regex: \s{2,}
    // subst: null
    tagText = tagText.replace(/\s{2,}/g, " ")
    
    // add space after every ; in style attributes
    // regex: ;([^\s])
    // subst: ; $1
    tagText = tagText.replace(/;([^\s])/g, "; $1")
    
    // remove space before "> close combination
    // regex: \s(">)
    // subst: $1
    tagText = tagText.replace(/\s(">)/g, "$1")    

    // ------------------------------------------------------------------

    // remove all whitespace between tags but not inside of tags
    // regex: >\s*<
    // subst: ><
    tagText = tagText.replace(/>\s*</g, "><")

    // remove all whitespace before the first tag or after the last tag
    // regex: ^(\s*)|(\s*)$
    // subst: null
    tagText = tagText.replace(/^(\s*)|(\s*)$/g, "")

    // remove spaces before tagText nodes
    // regex: >\s*
    // subst: >
    tagText = tagText.replace(/>\s*/g, ">")
    
    // remove spaces after tagText nodes
    // regex: \s*<
    // subst: <
    tagText = tagText.replace(/\s*</g, "<")

    // remove space between opening tag and first attribute
    // regex: (<\w*)(\s{2,})
    // subst: $1\s
    tagText = tagText.replace(/(<\w+)(\s{2,})/g, "$1 ")

    // remove space between attributes (trailing space)
    // regex: ([\w-_]+="[\w\s-_]+")(\s*(?!>))
    // subst: $1\s
    tagText = tagText.replace(/([\w-_]+="[\w\s-_]+")(\s*(?!>))/g, "$1 ")

    // remove space between last attribute and closing tag
    // regex: (\w+="\w+")(\s+)>
    // subst: $1>
    tagText = tagText.replace(/([\w-_]+="[\w\s-_]+")(\s{2,})>/g, "$1>")
    
    return tagText
}
function getNodeReferences(fragment, options){
    const result = {
        root: (fragment.childNodes.length === 1)
            ? fragment.firstElementChild
            : Array.from(fragment.childNodes),
        refs: {},
        ids: {},
    }

    if(options){
        const { refs, ids } = options
        // perf: use for-reverse-decement-condition
        // proof:  https://jsperf.com/for-vs-foreach/75
        // proof:  https://jsperf.com/reduce-vs-loop/12
        if(refs){
            for(let i = refs.length; i--;){
                result.refs[refs[i]] = fragment.querySelector(`[data-ref="${refs[i]}"]`)
            }
        }
        if(ids){
            for(let i = ids.length; i--;){
                result.ids[refs[i]] = fragment.getElementById(refs[i])
            }
        }
    } else {
        // perf: use for
        // proof:  https://jsperf.com/for-vs-foreach/75
        // perf: use recursion
        // proof: https://jsperf.com/dom-traversal-recursive-vs-iterative
        const nodes = Array.from(fragment.childNodes)
        for(let i = nodes.length; i--;){
            iterate(nodes[i], node => {
                // add data-ref references
                let ref = undefined
                if(node.dataset === undefined){
                    ref = node.getAttribute("data-ref")
                    if(ref !== null){
                        result.refs[ref] = node
                    }
                } else {
                    ref = node.dataset.ref
                    if(ref !== undefined){
                        result.refs[ref] = node
                    }
                }
                // add node id references
                if(node.id !== "") {
                    result.ids[node.id] = node
                }
            })
        } 
    }

    return result
}

// helpers
function iterate(node, callback){
    if(node !== null){
        if(!((node instanceof Node) && (node.nodeType === Node.ELEMENT_NODE))){
            return
        }
        // execute callback
        callback(node)
        if(node.hasChildNodes()){
            iterate(node.firstElementChild, callback)
        }
        if(node.nextElementSibling !== null){
            iterate(node.nextElementSibling, callback)
        }
    }
}

// method helpers
function getQueryType(query){
    return  query instanceof Node ? "Node" : 
            query.charAt(0) === "." ? "id" : 
            query.charAt(0) === "#" ? "class" : "query"
}

