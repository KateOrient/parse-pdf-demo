import React from 'react';
import {Document, pdfjs} from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import testPdf from './files/demo_tags.pdf';
import _ from 'lodash';

import PdfPage from './components/PdfPage';
import Header from './components/Header';
import './scss/main.scss';

//  Set pdf.js build
pdfjs.GlobalWorkerOptions.workerSrc = `pdf.worker.js`;
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

let refs = {
    containerRef: null,
    activeTagName: null,
    tagPath: null,
};

let loadedPages = 0;

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
            loading: true,
            bboxByPage: {},
        };
    }

    componentDidUpdate() {
        if (this.state.renderedPages === this.state.numPages) {
            console.log('BBoxes', this.state.boundingBoxes);
            this.setState({renderedPages: 0});
        }
    }

    //  Init data of uploaded PDF
    onDocumentLoadSuccess = (document) => {
        console.log(document);
        let structureTree = document._pdfInfo.structureTree || {};
        document.getMetadata().then(({info, metadata, contentDispositionFilename,}) => {
            let {RoleMap, ClassMap, Title} = info;
            let title = Title || this.state.pdf.name;
            this.setState({
                title,
                structureTree,
                roleMap: RoleMap || {},
                classMap: ClassMap || {},
            })
        });
        let {numPages} = document;
        this.setState({numPages});
    };

    //  Create page overlay for BBOXes
    onPageRenderSuccess = (page) => {
        page.getOperatorList().then((data) => {
            let positionData = data.argsArray[data.argsArray.length - 1];
            let bboxByPage = {...this.state.bboxByPage};
            bboxByPage[page.pageIndex] = positionData || {};
            console.log('Data:', positionData);

            let canvas = document.getElementsByTagName('canvas')[page.pageIndex];
            let rect = canvas.getBoundingClientRect();

            let bboxCanvas = document.createElement('canvas');
            bboxCanvas.style.top = rect.y + 'px';
            bboxCanvas.style.left = rect.x + 'px';
            bboxCanvas.style.height = rect.height + 'px';
            bboxCanvas.style.width = rect.width + 'px';
            bboxCanvas.height = rect.height;
            bboxCanvas.width = rect.width;
            bboxCanvas.style.position = 'absolute';
            bboxCanvas.id = 'bboxCanvas' + page.pageIndex;
            bboxCanvas.setAttribute('data-page', page.pageIndex);
            refs.containerRef.appendChild(bboxCanvas);
            let ctx = bboxCanvas.getContext('2d');
            ctx.translate(0, rect.height);   // reset where 0,0 is located
            ctx.scale(1, -1);

            bboxCanvas.onmousemove = this.onBboxMove;

            loadedPages++;
            if (loadedPages === this.state.numPages) {
                this.setState({
                    loading: false,
                    bboxByPage,
                });
            } else {
                this.state.bboxByPage = bboxByPage;
            }
        });
    }

    //  Build pages
    getPages() {
        let pagesArray = [];
        let {numPages} = this.state;

        for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
            pagesArray.push(
                <PdfPage pageIndex={pageIndex}
                         onPageRenderSuccess={this.onPageRenderSuccess}
                         key={"page-" + pageIndex}
                />
            );
        }

        return pagesArray;
    }

    /*
     * Get tag name of hovered bbox
     * @param mcid {integer} id of bbox
     * @param pageIndex {integer} tough pageIndex prevent confusing of wrong tag with similar mcid
     * @param node {object} structure for searching
     * @param parent {object} parent object for current node
     * @param path {array} tree path for current node
     *
     * @return {
     *      path {string} path to component through structure tree
     *      relatives {array} tags from the same level
     * }
     */
    findTag = (mcid, pageIndex, node = _.cloneDeep(this.state.structureTree), parent = null, path = []) => {
        if (node instanceof Array) {
            let result;
            node.forEach(child => {
                if (child) {
                    let data = this.findTag(mcid, pageIndex, child, node, path);
                    if (data) {
                        result = data;
                    }
                }
            });
            return result;
        } else if (node instanceof Object) {
            if (node.hasOwnProperty('mcid') && node.hasOwnProperty('pageIndex')) { //leaf
                if (node.mcid === mcid && node.pageIndex === pageIndex) {
                    return {
                        path,
                        relatives: _.flattenDeep(this.findChildren(parent)).filter(el => el)
                    }
                }
            } else {
                let result;
                Object.keys(node).forEach(childKey => {
                    if (node[childKey]) {
                        let data = this.findTag(mcid, pageIndex, node[childKey], node, [...path, childKey]);
                        if (data) {
                            result = data;
                        }
                    }
                });
                return result;
            }
        }
    };

    //Get all leafs that have node as a common root
    findChildren = (node) => {
        if (node === null) {
            return [];
        } else if (node instanceof Object) {
            if (node.hasOwnProperty('mcid') && node.hasOwnProperty('pageIndex')) {
                return node;
            } else {
                return Object.keys(node).map(childKey => {
                    return this.findChildren(node[childKey]);
                })
            }
        } else if (node instanceof Array) {
            return node.map(child => this.findChildren(child));
        }
    };

    //  Set React ref
    setRef(target) {
        return (node) => {
            refs[target] = node;
        };
    }

    isInBbox({x, y, bboxList}) {
        let bbox = false;
        Object.keys(bboxList).forEach((key) => {
            let isX = x >= bboxList[key].x && x <= (bboxList[key].x + bboxList[key].width);
            let isY = y >= bboxList[key].y && y <= (bboxList[key].y + bboxList[key].height);

            if (isX && isY) {
                bbox = {
                    ...bboxList[key],
                    mcid: key,
                };
            }
        });

        return bbox;
    }

    /*
    *   HANDLERS
    */

    onBboxMove = (e) => {
        let canvas = e.target;
        let rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = canvas.offsetHeight - (e.clientY - rect.top);
        let ctx = canvas.getContext('2d');
        let pageIndex = canvas.getAttribute('data-page');
        let bboxList = this.state.bboxByPage[pageIndex];

        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.strokeStyle = 'red';
        let bboxCoords = this.isInBbox({x, y, bboxList});
        if (!bboxCoords) {
            this.fillDocData();
            return;
        }

        let mcid = parseInt(bboxCoords.mcid);
        let result = this.findTag(mcid, +pageIndex);
        if (result) {
            let path = result.path;
            let relatives = result.relatives.filter(el => el.pageIndex === +pageIndex);
            let tagRoleMapPath = '';
            let minX = Number.MAX_VALUE;
            let maxX = 0;
            let minY = Number.MAX_VALUE;
            let maxY = 0;
            relatives.forEach(({mcid: elementMcid, pageIndex: page}, index) => {
                if (+pageIndex !== page || !bboxList[elementMcid]) return;
                let {x, y, width, height} = bboxList[elementMcid];
                if (_.isNaN(x) || _.isNaN(y) || _.isNaN(width) || _.isNaN(height)) return;
                if (!index) {
                    minX = x;
                    maxX = x + width;
                    minY = y;
                    maxY = y + height;
                }

                minX = minX < x ? minX : x;
                maxX = maxX > (x + width) ? maxX : (x + width);
                minY = minY < y ? minY : y;
                maxY = maxY > (y + height) ? maxY : (y + height);
            });

            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

            if (this.state.roleMap[path[path.length - 1]]) {
                tagRoleMapPath = '-> ' + this.state.roleMap[path[path.length - 1]].name;
            }

            this.fillDocData(`${path[path.length - 1]} ${tagRoleMapPath}`, path.join(' -> '), mcid);
        } else {
            ctx.strokeRect(bboxCoords.x, bboxCoords.y, bboxCoords.width, bboxCoords.height);
        }
    };

    fillDocData = (tagName = null, tagPath = null, mcid = null) => {
        const EMPTY = 'None';

        if (tagName) {
            refs.activeTagName.textContent = tagName;
            refs.tagPath.classList.remove('_empty');
        } else {
            refs.activeTagName.textContent = EMPTY;
            refs.tagPath.classList.add('_empty');
        }

        if (tagPath) {
            refs.tagPath.textContent = tagPath;
            refs.activeTagName.classList.remove('_empty');
        } else {
            refs.tagPath.textContent = EMPTY;
            refs.activeTagName.classList.add('_empty');
        }

        if (Number.isInteger(mcid)) {
            refs.mcid.textContent = mcid;
            refs.mcid.classList.remove('_empty');
        } else {
            refs.mcid.textContent = EMPTY;
            refs.mcid.classList.add('_empty');
        }
    };

    onUploadFile = (e) => {
        loadedPages = 0;
        this.setState({
            loading: true,
            bboxByPage: {},
        });
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.onload = this.onUploadEnd(file);

        if (!file) {
            this.setState({
                pdf: null,
                loading: false,
            });
            return;
        }
        reader.readAsArrayBuffer(file);
    }

    onUploadSctrictFile = (pdf) => {
        loadedPages = 0;
        this.setState({
            loading: true,
            bboxByPage: {},
        });
        this.onUploadEnd(pdf);
    }

    onUploadEnd = (pdf) => {
        document.getElementById('container').innerHTML = "";

        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf,
        })
    }

    onError = (e) => {
        this.setState({
            error: e.message,
            loading: false,
        });
    }

    render() {
        const {numPages, title, loading} = this.state;
        return (
            <div className={`App ${loading ? '_loading' : ''}`}>
                <Header onUploadFile={this.onUploadFile} onUploadSctrictFile={this.onUploadSctrictFile}
                        loading={loading}/>
                <main className="app-main-body">
                    <div className="pdf-wrapper">
                        <Document file={this.state.pdf}
                                  onLoadSuccess={this.onDocumentLoadSuccess}
                                  options={{
                                      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                      cMapPacked: true,
                                  }}
                                  onLoadError={this.onError}
                                  error={<div className="error-msg">{this.state.error}</div>}
                        >
                            {this.getPages()}
                        </Document>
                    </div>
                </main>
                <div id="container" ref={this.setRef('containerRef')}/>
                <div id="tagInfo">
                    <div className="tag-prop">
                        <div className="tag-info-title">Document title</div>
                        <div ref={this.setRef('activeTagName')}
                             className={title ? '' : '_empty'}>{title || 'None'}</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Number of pages</div>
                        <div ref={this.setRef('activeTagName')}>{numPages}</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Tag name</div>
                        <div ref={this.setRef('activeTagName')} className="_empty">None</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Tree path</div>
                        <div ref={this.setRef('tagPath')} className="_empty">None</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">MCID</div>
                        <div ref={this.setRef('mcid')} className="_empty">None</div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
