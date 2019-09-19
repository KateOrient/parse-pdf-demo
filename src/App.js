import React from 'react';
import { Document, Page, pdfjs } from "react-pdf";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './App.css';
import testPdf from './demo_tags.pdf';
import _ from 'lodash';

//  Set pdf.js build
pdfjs.GlobalWorkerOptions.workerSrc = `pdf.worker.js`;
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;


let uploadInputRef;
let containerRef;

function Pages({ numPages, onPageRenderSuccess }) {
    let pagesArray = [];

    for (let i = 1; i <= numPages; i++) {
        pagesArray.push(
            <Page className="pdf-page"
                  pageNumber={i}
                  key={`page-${i}`}
                  renderAnnotationLayer={true}
                  renderInteractiveForms={true}
                  renderTextLayer={true}
                  onRenderSuccess={onPageRenderSuccess}
                  customTextRenderer={({height,  width, transform, scale, page, str}) => {
                      /*
                      height: height of text
                      width: width of text
                      transform: contain coordinates of text
                      scale: will be used for coords. conversing
                       */
                      return str;
                  }}
            />
        );
    }

    return pagesArray;
}

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            numPages: null,
            pageNumber: 1,
            pdf: testPdf,
            title: testPdf.name,
            boundingBoxes: null,
            renderedPages: 0,
            error: null,
            structureTree: {},
            roleMap: {},
            classMap: {},
            activeTagName: null,
            tagPath: null,
        };
    }

    componentDidUpdate() {
        if (this.state.renderedPages === this.state.numPages) {
            console.log('BBoxes', this.state.boundingBoxes);
            this.setState({renderedPages: 0});
        }
    }

    onDocumentLoadSuccess = (document) => {
        console.log(document);
        let structureTree = document._pdfInfo.structureTree || {};
        document.getMetadata().then(({ info, metadata, contentDispositionFilename, }) => {
            let { RoleMap, ClassMap, Title } = info;
            let title = Title || this.state.pdf.name;
            this.setState({
                title,
                structureTree,
                roleMap: RoleMap || {},
                classMap: ClassMap || {},
            })
        });
        let {numPages} = document;
        this.setState({ numPages });
    };

    onPageRenderSuccess = (page) => {
        /*page.getOperatorList().then(data => {
            let boundingBoxes = data.argsArray[data.argsArray.length - 1][0];
            this.setState({
                boundingBoxes:
                    this.state.boundingBoxes && this.state.renderedPages !== 0  ?
                        {...this.state.boundingBoxes, ...boundingBoxes} : boundingBoxes,
                renderedPages: this.state.renderedPages + 1
            })
        });*/

        page.getOperatorList().then((data) => {
            let positionData = data.argsArray[data.argsArray.length - 1];
            console.log('Data:', positionData);

            let canvas = document.getElementsByTagName('canvas')[page.pageIndex];
            let rect = canvas.getBoundingClientRect();

            let div = document.createElement('div');
            div.innerHTML = "";
            div.style.top = rect.y + 'px';
            div.style.left = rect.x + 'px';
            div.style.height = rect.height + 'px';
            div.style.width = rect.width + 'px';
            div.style.position = 'absolute';
            div.id = 'div' + page.pageIndex;
            containerRef.appendChild(div);

            div = document.getElementById('div' + page.pageIndex);
            _.map(positionData, (position, mcid) => {
                let child = document.createElement('div');
                child.style.top = parseInt(canvas.style.height, 10) - position.y - position.height  + 'px';
                child.style.left = position.x + 'px';
                child.style.height = position.height + 'px';
                child.style.width = position.width + 'px';
                child.className = 'bbox';
                child.setAttribute('data-mcid', mcid);
            	child.title = mcid;
                child.onmouseover = this.onBboxOver;
                child.onmouseout  = this.onBboxOut;
                div.appendChild(child);
            })
        });
    }

    onBboxOver = (e) => {
        let mcid = parseInt(e.target.getAttribute('data-mcid'));
        let { name, relatives, path } = this.getTagName(mcid);
        let bboxTagname = e.target.getAttribute('data-tag-name');
        let tagRoleMapPath = '';
        if (!bboxTagname) {
            e.target.setAttribute('data-tag-name', name);
        }

        relatives.forEach((elementMcid) => {
            document.querySelector(`[data-mcid="${elementMcid}"]`).classList.add('_hovered');
        });

        e.target.classList.add('_hovered');

        if (this.state.roleMap[name]) {
            tagRoleMapPath = '-> ' + this.state.roleMap[name].name;
        }

        this.setState({
            activeTagName: `${name} ${tagRoleMapPath}`,
            tagPath: path.join(' -> '),
        });
    }

    onBboxOut = (e) => {
        [...document.querySelectorAll('._hovered')].forEach((el) => {
            el.classList.remove('_hovered');
        });

        this.setState({
            activeTagName: '',
            tagPath: '',
        });
    }

    getTagName(mcid, tagNode = this.state.structureTree) {
        let node = '';
        let relatives = [];
        let path = [];
        Object.keys(tagNode).forEach((nodeName) => {
            path = [nodeName];
            if (tagNode[nodeName] === mcid) {
                node = nodeName;
            } else if (tagNode[nodeName] instanceof Array) {
                if (tagNode[nodeName].includes(mcid)) {
                    node = nodeName;
                    relatives = this.getRelatives(tagNode[nodeName]);
                } else {
                    node = tagNode[nodeName].filter((nodeFromArray) => {
                        if (!nodeFromArray) {
                            return false;
                        }
                        return !!this.getTagName(mcid, nodeFromArray).name;
                    })[0];
                    if (node) {
                        node = this.getTagName(mcid, node);
                        relatives = node.relatives;
                        path = [...path, ...node.path];
                        node = node.name;
                    }
                }
            } else if (tagNode[nodeName] instanceof Object) {
                node = this.getTagName(mcid, tagNode[nodeName]);
                relatives = node.relatives;
                path = [...path, ...node.path];
                node = node.name;
            }
        });

        return {
            name: node,
            relatives,
            path
        };
    }

    getRelatives(arrayOfRelatives) {
        let relatives = [];
        arrayOfRelatives.forEach((relative) => {
            if (!relative) return;
            if (typeof relative === 'number') {
                relatives.push(relative);
            } else if (relative instanceof Array && relative.length) {
                relatives = [
                    ...relatives,
                    ...this.getRelatives(relative)
                ];
            } else if (relative instanceof Object) {
                relatives = [
                    ...relatives,
                    ...this.getRelatives(Object.entries(relative))
                ];
            }
        });

        return relatives;
    }

    uploadFile = (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.onload = this._onUploadEnd(file);

        if (!file) {
            this.setState({
                pdf: null
            });
            return;
        }
        reader.readAsArrayBuffer(file);
    }

    uploadPdf = () => {
        uploadInputRef.click();
    }

    _onUploadEnd = (pdf) => {
        document.getElementById('container').innerHTML = "";

        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf
        })
    }

    _setRef(node) {
        uploadInputRef = node;
    }

    setContainerRef(node) {
        containerRef = node;
    }

    onError = (e) => {
        this.setState({
           error: e.message
        });
    }

    render() {
        const { pageNumber, numPages, title } = this.state;

        return (
            <div className="App">
                <header className="App-header">
                    <button onClick={this.uploadPdf}>
                        Upload other pdf
                    </button>
                    <input type='file' onChange={this.uploadFile.bind(this)} ref={this._setRef} style={{'display': 'none'}}/>
                </header>
                <article className="app-main-body">
                    <div className="pdf-data">
                        <p><b>Title: </b>{title}</p>
                        <p><b>Number of pages: </b>{numPages}</p>
                    </div>
                    <div className="pdf-wrapper">
                        <Document file={this.state.pdf}
                                  onLoadSuccess={this.onDocumentLoadSuccess}
                                  options={{
                                      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                      cMapPacked: true,
                                  }}
                                  onLoadError={this.onError}
                                  error={<div className="error-msg">{this.state.error}</div> }
                        >
                            {Pages({ pageNumber, numPages, onPageRenderSuccess: this.onPageRenderSuccess })}
                        </Document>
                    </div>
                </article>
                <div id="container" ref={this.setContainerRef}/>
                <div id="tagInfo">
                    <div>
                        <span className="tag-info-title">Tag name: </span>{this.state.activeTagName}
                    </div>
                    <div>
                        <span className="tag-info-title">Tree path: </span>{this.state.tagPath}
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
